import { useEffect, useRef, useState } from 'react';
import { Modal, View, Animated, StyleSheet, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
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
export function ProductModal() {
  const { openProductId, close } = useProductModalStore();
  const { height: windowHeight } = useWindowDimensions();
  const [localId, setLocalId] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  // Resetting the Animated.Values and calling .start() in the same effect
  // that sets localId raced the card's own mount — setLocalId's re-render
  // hadn't committed yet, so the Animated.View receiving these values often
  // didn't exist for the first chunk (sometimes all) of the animation's
  // timeline, making the fade-in invisible while the fade-out (where the
  // card already exists) worked fine. Splitting into two effects, with the
  // animation keyed on localId itself, guarantees the card is already
  // mounted — at the reset (opacity 0) values — before .start() runs.
  useEffect(() => {
    if (openProductId) setLocalId(openProductId);
  }, [openProductId]);

  useEffect(() => {
    if (!localId) return;
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = true;
    if (!wasOpen) {
      // Both on the same timing curve and duration, not a spring for scale —
      // a spring settles well after a 250ms fade completes, so the card hit
      // full opacity while still visibly growing, reading as "pops up, then
      // keeps transitioning" instead of one motion finishing together.
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: Animation.standard, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: Animation.standard, useNativeDriver: true }),
      ]).start();
    }
  }, [localId]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: Animation.micro, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.96, duration: Animation.micro, useNativeDriver: true }),
    ]).start(() => {
      close();
      setLocalId(null);
      wasOpenRef.current = false;
    });
  }

  return (
    <Modal transparent visible={!!openProductId || !!localId} onRequestClose={handleClose} animationType="none">
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        </Animated.View>
      </TouchableWithoutFeedback>
      <View style={styles.centerWrap} pointerEvents="box-none">
        {localId && (
          <Animated.View style={[styles.card, { maxHeight: windowHeight * 0.88, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <ProductDetailContent productId={localId} onClose={handleClose} />
          </Animated.View>
        )}
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
