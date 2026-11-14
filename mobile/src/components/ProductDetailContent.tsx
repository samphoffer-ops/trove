import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, LayoutChangeEvent, Share, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useReducedMotion,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useProductsStore, getProductById } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { ImageGallery } from '@/components/ImageGallery';
import { Glass } from '@/components/GlassHeader';
import { ChevronLeftIcon, BookmarkIcon, ShareIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing, Animation } from '@/lib/theme';
import { Product, Profile } from '@/types';
import { usePriceFormatter } from '@/store/useCurrencyStore';
import { getClickOutUrl } from '@/lib/clickOut';
import { goBack, openExternal, openSaveSheet } from '@/lib/navigation';
import { Rect, setSourceHidden } from '@/lib/sharedTransition';
import * as haptics from '@/lib/haptics';

// Hero drifts at 30% of scroll speed. Subtle on purpose (spec §5).
const PARALLAX = 0.3;
// Edge-swipe dismiss: how far (fraction of width) or how fast before it commits.
const DISMISS_DISTANCE = 0.3;
const DISMISS_VELOCITY = 800;
const SPRING = { ...Animation.spring, overshootClamping: true };

interface Props {
  productId: string;
  topInset?: number;
  bottomInset?: number;
  // Set when rendered inside the desktop glass modal (ProductModal.tsx)
  onClose?: () => void;
  // Caps the photo height. The modal sizes this from the window so the
  // brand/name/price clear the sticky Shop bar on open.
  heroMaxHeight?: number;
  // Native route only (app/product/[id].tsx): the card image's window rect
  // to grow the hero out of. null = crossfade. See lib/sharedTransition.ts.
  source?: Rect | null;
  // Native route only: called once the dismiss animation has finished.
  onDismissed?: () => void;
}

// "Why it's in your edit" (spec §7), from the onboarding taste profile's
// style and category signals. Hidden when nothing in the profile explains
// the product. Onboarding has no brand-picks step (#56), so no brand variant.
function whyInYourEdit(product: Product, profile: Profile | null): string | null {
  if (!profile) return null;
  const has = (list: string[] | undefined, value: string | undefined) =>
    !!value && (list ?? []).some(v => v.toLowerCase() === value.toLowerCase());

  const style = product.styles?.find(s => has(profile.taste_styles, s));
  if (style) return `Matches the ${style.toLowerCase()} side of your taste.`;
  if (has(profile.taste_categories, product.category)) {
    return `From the ${product.category} you said you wear.`;
  }
  return null;
}

// Native share sheet with the product's page on the brand's site. The old
// ShareSheet sent to followed friends over DMs, which are v1.1 (#64).
function shareProduct(product: Product) {
  Share.share({ message: `${product.name} by ${product.brand}`, url: product.url });
}

export function ProductDetailContent({ productId, topInset = 0, bottomInset = 0, onClose, heroMaxHeight, source = null, onDismissed }: Props) {
  const { isProductSaved } = useBoardStore();
  const { user, profile } = useAuthStore();
  const { loaded, fetchProducts } = useProductsStore();
  const formatPrice = usePriceFormatter();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [fallbackProduct, setFallbackProduct] = useState<Product | null>(null);

  // Transition state. `progress` runs 0 (card / invisible) → 1 (detail).
  // The modal and web route render at 1 with no transition.
  const animated = !!onDismissed;
  const progress = useSharedValue(animated ? 0 : 1);
  const scrollY  = useSharedValue(0);
  const rootRef  = useRef<View>(null);
  const [frame, setFrame]   = useState<Rect | null>(null);
  const [heroHeight, setHeroHeight] = useState(0);
  const [ready, setReady]   = useState(!animated);
  // Liquid Glass renders blank under an ancestor with animated opacity, so
  // the glass controls aren't faded with the rest of the chrome: they mount
  // once the entrance settles and unmount as a dismiss starts.
  const [glassShown, setGlassShown] = useState(!animated);
  const showGlass = (finished?: boolean) => { 'worklet'; if (finished) scheduleOnRN(setGlassShown, true); };
  const flight = useMemo(() => (
    animated && !reduceMotion && source && frame && heroHeight
      ? { src: source, tgt: { x: frame.x, y: frame.y, width: frame.width, height: heroHeight } }
      : null
  ), [animated, reduceMotion, source, frame, heroHeight]);

  useEffect(() => { fetchProducts(); }, []);

  const storeProduct = getProductById(productId);

  // If the store is loaded but doesn't have this product (e.g. opened from an
  // inbox share that isn't in the user's feed slice), fetch it directly by ID.
  useEffect(() => {
    if (!loaded || storeProduct) return;
    supabase.from('products').select('*').eq('id', productId).single()
      .then(({ data }) => { if (data) setFallbackProduct(data as Product); });
  }, [loaded, storeProduct, productId]);

  const product = storeProduct ?? fallbackProduct;

  useEffect(() => {
    if (!user || !product) return;
    supabase.from('product_views').upsert(
      { user_id: user.id, product_id: product.id },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
  }, [user, product?.id]);

  // Run the entrance once the hero's target position is known.
  useEffect(() => {
    if (!animated || ready || !frame || !heroHeight) return;
    setReady(true);
    if (flight) {
      setSourceHidden(productId, true);
      progress.value = withSpring(1, SPRING, showGlass);
    } else {
      progress.value = withTiming(1, { duration: Animation.standard }, showGlass);
    }
  }, [animated, ready, frame, heroHeight]);

  // Never leave the card hidden, whatever unmounts this screen.
  useEffect(() => () => setSourceHidden(productId, false), [productId]);

  function finishDismiss() {
    setSourceHidden(productId, false);
    onDismissed?.();
  }

  function dismiss() {
    if (onClose) return onClose();
    if (!animated) return goBack('/(tabs)/feed');
    const done = (finished?: boolean) => { 'worklet'; if (finished) scheduleOnRN(finishDismiss); };
    setGlassShown(false);
    progress.value = flight
      ? withSpring(0, SPRING, done)
      : withTiming(0, { duration: Animation.standard }, done);
  }

  // iOS edge-swipe back. A transparent modal doesn't get the native one, so
  // the swipe scrubs the shared transition in reverse instead.
  const flying = !!flight;
  const edgeSwipe = Gesture.Pan()
    .enabled(animated)
    .hitSlop({ left: 0, width: 24 })
    .activeOffsetX(10)
    .onStart(() => { scheduleOnRN(setGlassShown, false); })
    .onUpdate(e => {
      progress.value = Math.min(1, Math.max(0, 1 - e.translationX / windowWidth));
    })
    .onEnd(e => {
      const commit = e.translationX > windowWidth * DISMISS_DISTANCE || e.velocityX > DISMISS_VELOCITY;
      const done = (finished?: boolean) => { 'worklet'; if (finished) scheduleOnRN(finishDismiss); };
      if (!commit) progress.value = withSpring(1, SPRING, showGlass);
      else if (flying) progress.value = withSpring(0, SPRING, done);
      else progress.value = withTiming(0, { duration: Animation.standard }, done);
    });

  const onScroll = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  // Crossfade: everything fades together. Flight: the hero flies at full
  // opacity and the text and controls fade in over the back half.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: !ready ? 0 : flying ? 1 : progress.value,
  }), [ready, flying]);
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: flying ? interpolate(progress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) : 1,
  }), [flying]);

  const heroStyle = useAnimatedStyle(() => {
    const s = scrollY.value;
    const parallax = reduceMotion || s <= 0 ? 0 : s * PARALLAX;
    if (!flight) return { transform: [{ translateY: parallax }] };

    // Uniform scale works because the card and the hero share the product's
    // aspect ratio. Translation accounts for the current scroll offset, so
    // dismissing from partway down the page still lands on the card.
    // The hero rises above the info panel only while it's in flight; once
    // settled the panel draws over it, so parallax never hides the title.
    const k = progress.value;
    const { src, tgt } = flight;
    const scale = src.width / tgt.width;
    const dx = (src.x + src.width / 2) - (tgt.x + tgt.width / 2);
    const dy = (src.y + src.height / 2) - (tgt.y + tgt.height / 2 - s);
    return {
      zIndex: k < 1 ? 1 : 0,
      transform: [
        { translateX: dx * (1 - k) },
        { translateY: parallax * k + dy * (1 - k) },
        { scale: scale + (1 - scale) * k },
      ],
      borderRadius: (Radius.card / scale) * (1 - k),
    };
  }, [flight, reduceMotion]);

  function onRootLayout() {
    rootRef.current?.measureInWindow((x, y, width, height) => setFrame({ x, y, width, height }));
  }

  function onHeroLayout(e: LayoutChangeEvent) {
    setHeroHeight(e.nativeEvent.layout.height);
  }

  function goToBrand(brandId: string) {
    onClose?.();
    router.push(`/brand/${brandId}`);
  }

  if (!loaded || (loaded && !storeProduct && !fallbackProduct)) {
    return (
      <View style={[styles.root, styles.solid, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }
  if (!product) return null;

  const saved = isProductSaved(product.id);
  const why = whyInYourEdit(product, profile);

  // Build image array: hero first, extras deduplicated
  const galleryImages = [product.image, ...(product.images ?? []).filter(u => u && u !== product.image)];

  return (
    <GestureDetector gesture={edgeSwipe}>
      <View ref={rootRef} style={[styles.root, !animated && styles.solid]} onLayout={onRootLayout} collapsable={false}>
        {animated && <Animated.View style={[StyleSheet.absoluteFill, styles.solid, backdropStyle]} />}

        <Animated.View style={[styles.root, contentStyle]}>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero: full-width carousel at the product's own ratio, never cropped */}
            <Animated.View style={[styles.hero, heroStyle]} onLayout={onHeroLayout}>
              <ImageGallery
                images={galleryImages}
                blurhash={product.blurhash}
                ratio={product.ratio}
                aspectRatio={1 / product.ratio}
                contentFit="contain"
                maxHeight={heroMaxHeight ?? (onClose ? 460 : undefined)}
              />
            </Animated.View>

            <Animated.View style={[styles.body, chromeStyle]}>
              {product.brand_id ? (
                <Pressable onPress={() => goToBrand(product.brand_id!)} hitSlop={8}>
                  <Text style={styles.brand}>{product.brand}</Text>
                </Pressable>
              ) : (
                <Text style={styles.brand}>{product.brand}</Text>
              )}
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.price}>{formatPrice(product)}</Text>
              {why && <Text style={styles.why} numberOfLines={1}>{why}</Text>}
              {/* Only the brand's own copy: no stand-in text when there's none */}
              {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}
            </Animated.View>
          </Animated.ScrollView>

          {/* The one primary action, bottom-anchored in the thumb zone */}
          <Animated.View style={[styles.actions, { paddingBottom: bottomInset + Spacing[4] }, chromeStyle]}>
            <Pressable style={styles.shopBtn} onPress={() => openExternal(getClickOutUrl(product.id))} accessibilityRole="link">
              <Text style={styles.shopBtnText} numberOfLines={1}>Shop at {product.brand}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Glass header controls, fixed over the photo. Outside the faded
            content on purpose (see glassShown). */}
        {glassShown && (
          <View style={[styles.header, { top: topInset + Spacing[3] }]} pointerEvents="box-none">
            <GlassButton label="Back" onPress={dismiss}>
              <ChevronLeftIcon size={20} />
            </GlassButton>
            <View style={styles.headerActions}>
              <GlassButton label="Share" onPress={() => shareProduct(product)}>
                <ShareIcon size={18} />
              </GlassButton>
              <GlassButton label={saved ? 'Saved to a board' : 'Save to board'} onPress={() => { haptics.saveToBoard(); openSaveSheet(product); }}>
                <BookmarkIcon color={saved ? Colors.accent : Colors.text} filled={saved} size={18} />
              </GlassButton>
            </View>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

// Same Liquid Glass as the feed header controls (GlassHeader), so detail and
// feed float the same material over photos.
function GlassButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      <Glass style={styles.glassBtn}>{children}</Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  solid: { backgroundColor: Colors.bg },

  hero: { width: '100%', overflow: 'hidden', backgroundColor: Colors.stoneSoft },

  header: {
    position:       'absolute',
    left:           Spacing.screen,
    right:          Spacing.screen,
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  headerActions: { flexDirection: 'row', gap: Spacing[4] },
  glassBtn: {
    width:          44,   // Apple's minimum hit target, matching GlassHeader
    height:         44,
    borderRadius:   Radius.full,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Opaque so the panel slides over the slower-moving (parallax) hero.
  body: { backgroundColor: Colors.bg, paddingHorizontal: Spacing.screen, paddingTop: Spacing[5], paddingBottom: Spacing[3] },

  brand: {
    ...Typography.label,
    color:        Colors.accentBlue,
    marginBottom: Spacing[3],
  },
  name: {
    ...Typography.headline,
    color:        Colors.text,
    marginBottom: Spacing[3],
  },
  price: {
    ...Typography.price,
    color:        Colors.text,
    marginBottom: Spacing[5],
  },
  why: {
    ...Typography.subhead,
    color:        Colors.text,
    marginBottom: Spacing[5],
  },
  desc: {
    ...Typography.body,
    color:        Colors.textMuted,
  },

  // Sticky CTA
  actions: {
    position:          'absolute',
    bottom:            0, left: 0, right: 0,
    paddingHorizontal: Spacing.screen,
    paddingTop:        Spacing[4],
    backgroundColor:   'rgba(253,252,249,0.97)',
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
  },
  shopBtn: {
    backgroundColor:   Colors.accent,
    borderRadius:      Radius.full,
    paddingVertical:   16,
    paddingHorizontal: Spacing[5],
    alignItems:        'center',
  },
  shopBtnText: { ...Typography.cardTitle, color: Colors.text },
});
