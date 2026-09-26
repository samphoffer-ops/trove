import { useRef, useState } from 'react';
import { View, Pressable, Platform, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent, GestureResponderEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Colors } from '@/lib/theme';
import { ChevronLeftIcon } from './Icons';

// Arrows show on hover via real CSS :hover rather than JS hover state —
// react-native-web doesn't deliver pointer enter/leave on a plain View, so
// state-driven arrows never appeared. Touch browsers (hover: none) hide
// them entirely; they can swipe.
function injectGalleryArrowCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('trove-gallery-arrows')) return;
  const style = document.createElement('style');
  style.id = 'trove-gallery-arrows';
  style.textContent = `
    [data-trove-gallery-arrow] { opacity: 0; transition: opacity 0.15s ease; }
    [data-trove-gallery]:hover [data-trove-gallery-arrow] { opacity: 1; }
    @media (hover: none) { [data-trove-gallery-arrow] { display: none !important; } }
  `;
  document.head.appendChild(style);
}

// react-native-web renders `dataSet` as data-* attributes; RN's types don't
// know the prop, hence the cast. No-op on native.
function webData(data: Record<string, string>) {
  return Platform.OS === 'web' ? ({ dataSet: data } as object) : {};
}

interface Props {
  images:      string[];     // at least 1; first is always the hero
  maxHeight?:  number;       // caps the gallery height (for modal context)
  aspectRatio?: number;      // overrides the default 3:4 (e.g. masonry cards use a per-product ratio)
}

// Simple horizontal-pager gallery. Works with a single image (dots hidden,
// no swipe chrome) — so ProductDetailContent doesn't need to branch.
//
// Uses onLayout (not useWindowDimensions) for page width — on web the window
// can be 1200px wide while the modal is only 460px, so useWindowDimensions
// would make every image page 1200px wide and pagingEnabled would scroll
// by 1200px at a time. onLayout always reflects the actual rendered size.
export function ImageGallery({ images, maxHeight, aspectRatio }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Deduplicate: scraper sometimes includes the hero twice
  const unique = Array.from(new Set(images.filter(Boolean)));
  injectGalleryArrowCss();
  const multi  = unique.length > 1;

  const pageWidth = containerWidth || windowWidth;
  // Tiny thumbnails (e.g. the brand page grid, ~80px) skip the arrows —
  // a 32px button would cover half the photo, and tapping through to the
  // product opens the full-size gallery anyway.
  const showArrows = Platform.OS === 'web' && pageWidth >= 140;

  // Single image (the common case, most products) skips the ScrollView
  // entirely — an unvirtualized masonry grid mounts every card at once, and
  // a gesture-handler ScrollView per card (for swiping) is real native
  // overhead multiplied across the whole feed. Only pay for it when a
  // product actually has extra photos to swipe through.
  if (!multi) {
    return (
      <View style={styles.root}>
        <Image
          source={{ uri: unique[0] }}
          style={[
            styles.img,
            aspectRatio ? { aspectRatio } : undefined,
            maxHeight ? { height: maxHeight } : undefined,
          ]}
          contentFit="cover"
        />
      </View>
    );
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!multi) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setActiveIndex(idx);
  }

  // Desktop web has no swipe, so it gets prev/next arrows on hover. The
  // gallery usually sits inside a pressable card, so the arrow press must
  // not bubble up and open the product.
  function goTo(e: GestureResponderEvent, idx: number) {
    e.stopPropagation();
    e.preventDefault?.();
    const next = Math.max(0, Math.min(unique.length - 1, idx));
    scrollRef.current?.scrollTo({ x: next * pageWidth, animated: true });
    setActiveIndex(next);
  }

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerWidth(w);
  }

  return (
    <View style={styles.root} onLayout={onLayout} {...webData({ troveGallery: '' })}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={multi}
        style={{ maxHeight }}
      >
        {unique.map((uri, i) => (
          <View key={i} style={[styles.page, { width: pageWidth }]}>
            <Image
              source={{ uri }}
              style={[
                styles.img,
                aspectRatio ? { aspectRatio } : undefined,
                maxHeight ? { height: maxHeight } : undefined,
              ]}
              contentFit="cover"
            />
          </View>
        ))}
      </ScrollView>

      {showArrows && activeIndex > 0 && (
        <Pressable
          {...webData({ troveGalleryArrow: '' })}
          style={[styles.arrow, styles.arrowLeft]}
          onPress={(e) => goTo(e, activeIndex - 1)}
          accessibilityLabel="Previous photo"
          hitSlop={6}
        >
          <ChevronLeftIcon size={16} />
        </Pressable>
      )}
      {showArrows && activeIndex < unique.length - 1 && (
        <Pressable
          {...webData({ troveGalleryArrow: '' })}
          style={[styles.arrow, styles.arrowRight]}
          onPress={(e) => goTo(e, activeIndex + 1)}
          accessibilityLabel="Next photo"
          hitSlop={6}
        >
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <ChevronLeftIcon size={16} />
          </View>
        </Pressable>
      )}

      {/* Dot indicators — hidden when there's only one image */}
      {multi && (
        <View style={styles.dots}>
          {unique.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', backgroundColor: Colors.stoneSoft },
  page: { overflow: 'hidden' },
  img:  { width: '100%', aspectRatio: 3 / 4, backgroundColor: Colors.stoneSoft },
  arrow: {
    position:        'absolute',
    top:             '50%',
    marginTop:       -16,
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems:      'center',
    justifyContent:  'center',
    boxShadow:       '0 1px 4px rgba(0,0,0,0.18)',
  },
  arrowLeft:  { left: 8 },
  arrowRight: { right: 8 },
  dots: {
    position:       'absolute',
    bottom:         12,
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            6,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width:           16,
    borderRadius:    3,
  },
});
