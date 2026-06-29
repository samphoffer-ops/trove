import { useEffect, useRef, useState } from 'react';
import { Modal, View, Animated, Platform, StyleSheet, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useProductModalStore } from '@/store/useProductModalStore';
import { ProductDetailContent } from './ProductDetailContent';
import { Colors, Radius, Shadows, Animation } from '@/lib/theme';

// The desktop-web "liquid glass" product view — see lib/navigation.ts's
// openProduct() for what routes here vs a plain page. Rendered once in the
// root layout; the feed (or whatever screen opened it) stays mounted and
// visible underneath, which is the whole point — BlurView's blur is of
// whatever's actually behind it, not a fake/static backdrop.
//
// Animates itself explicitly rather than relying on Modal's animationType —
// every other sheet in this app (SaveSheet, ShareSheet, etc.) does the same,
// since react-native-web doesn't reliably animate a plain Modal.
//
// The Modal itself, and the Animated.Views carrying the fade/scale, are
// ALWAYS mounted from app start (never conditionally rendered) — only
// ProductDetailContent mounts/unmounts with localId. Closing always
// animated correctly because it runs on a node that's been alive and
// "live" for a while; opening kept failing because the animated node was
// freshly created on every open, and starting an animation against a node
// in the same tick (or even one effect-cycle later) it was created raced
// react-native-web's ref/style-attachment for that fresh node. Keeping the
// shell permanently mounted makes every open run on an already-live node,
// the same condition that's made closing reliable from the start.
export function ProductModal() {
  // Native never opens this modal (openProduct() only routes here on a wide
  // web viewport — see lib/navigation.ts), but more importantly: keeping the
  // Modal permanently `visible` below is a web-only trick (toggling display/
  // pointerEvents instead of mount/unmount). A real native Modal ignores
  // that and would sit on screen as an actual OS-level presentation —
  // blocking the whole app — regardless of how "empty" its content is.
  // Platform.OS is static for the app's lifetime, so this conditional
  // return never changes across re-renders and is safe ahead of hooks.
  if (Platform.OS !== 'web') return null;

  const { openProductId, close } = useProductModalStore();
  const { height: windowHeight } = useWindowDimensions();
  const [localId, setLocalId] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (openProductId) setLocalId(openProductId);
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = !!openProductId;
    if (openProductId && !wasOpen) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: Animation.standard, useNativeDriver: false }),
        Animated.timing(scaleAnim, { toValue: 1, duration: Animation.standard, useNativeDriver: false }),
      ]).start();
    }
  }, [openProductId]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: Animation.micro, useNativeDriver: false }),
      Animated.timing(scaleAnim, { toValue: 0.96, duration: Animation.micro, useNativeDriver: false }),
    ]).start(() => {
      close();
      setLocalId(null);
    });
  }

  const open = !!openProductId || !!localId;

  return (
    <Modal transparent visible style={{ display: open ? 'flex' : 'none' } as any} onRequestClose={handleClose} animationType="none">
      {open && (
        // Deliberately NOT wrapped in the fadeAnim-driven Animated.View —
        // backdrop-filter blurs whatever's behind it in the page, but an
        // ancestor with an animated (or any <1) opacity creates a new
        // compositing layer that the blur samples instead, breaking the
        // glass effect entirely (confirmed: this is exactly what made the
        // blur vanish while the card's drop-shadow kept rendering fine,
        // since the shadow has nothing to do with backdrop-filter). The
        // card's own fade/scale below is unaffected and still animates.
        <TouchableWithoutFeedback onPress={handleClose}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      )}
      <View style={styles.centerWrap} pointerEvents={open ? 'box-none' : 'none'}>
        <Animated.View style={[styles.card, { maxHeight: windowHeight * 0.88, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          {localId && <ProductDetailContent productId={localId} onClose={handleClose} />}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: {
    width: 460,
    maxWidth: '100%',
    borderRadius: Radius.phone,
    overflow: 'hidden',
    backgroundColor: Colors.bg,
    ...Shadows.phone,
  },
});
