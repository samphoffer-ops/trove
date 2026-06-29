import { useEffect, useRef } from 'react';
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
// IMPORTANT: the Modal (and everything inside it) genuinely mounts/unmounts
// with `openProductId` — `return null` below when there's nothing open.
// An earlier version tried keeping the Modal permanently `visible` and
// hiding it via style only, to dodge an animation-timing race on a freshly
// mounted node — that broke real interaction with the entire page behind
// it (a Modal's overlay/portal layer isn't just a stylable child View; it
// has its own presence regardless of what's rendered inside it). The race
// is solved here a different way instead: a double requestAnimationFrame
// defers starting the animation until after the freshly-mounted node has
// actually committed/painted, without keeping anything around when closed.
export function ProductModal() {
  // Native never opens this modal (openProduct() only routes here on a wide
  // web viewport — see lib/navigation.ts). Platform.OS is static for the
  // app's lifetime, so this conditional return never changes across
  // re-renders and is safe ahead of hooks.
  if (Platform.OS !== 'web') return null;

  const { openProductId, close } = useProductModalStore();
  const { height: windowHeight } = useWindowDimensions();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (!openProductId) return;
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.96);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fadeAnim,  { toValue: 1, duration: Animation.standard, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1, duration: Animation.standard, useNativeDriver: false }),
        ]).start();
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [openProductId]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: Animation.micro, useNativeDriver: false }),
      Animated.timing(scaleAnim, { toValue: 0.96, duration: Animation.micro, useNativeDriver: false }),
    ]).start(() => close());
  }

  if (!openProductId) return null;

  return (
    <Modal transparent visible onRequestClose={handleClose} animationType="none">
      <TouchableWithoutFeedback onPress={handleClose}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
      </TouchableWithoutFeedback>
      <View style={styles.centerWrap} pointerEvents="box-none">
        <Animated.View style={[styles.card, { maxHeight: windowHeight * 0.88, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <ProductDetailContent productId={openProductId} onClose={handleClose} />
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
