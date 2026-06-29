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

  useEffect(() => {
    if (openProductId) setLocalId(openProductId);
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = !!openProductId;
    if (openProductId && !wasOpen) {
      // A genuine open (not a same-modal product swap via similar items) —
      // reset to the start state first so this plays from the beginning.
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.96);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: Animation.standard, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, ...Animation.spring }),
      ]).start();
    }
  }, [openProductId]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: Animation.micro, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.96, duration: Animation.micro, useNativeDriver: true }),
    ]).start(() => {
      close();
      setLocalId(null);
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
