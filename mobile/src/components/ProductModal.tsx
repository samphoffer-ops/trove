import { Modal, View, StyleSheet, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useProductModalStore } from '@/store/useProductModalStore';
import { ProductDetailContent } from './ProductDetailContent';
import { Colors, Radius, Shadows } from '@/lib/theme';

// The desktop-web "liquid glass" product view — see lib/navigation.ts's
// openProduct() for what routes here vs a plain page. Rendered once in the
// root layout; the feed (or whatever screen opened it) stays mounted and
// visible underneath, which is the whole point — BlurView's blur is of
// whatever's actually behind it, not a fake/static backdrop.
export function ProductModal() {
  const { openProductId, close } = useProductModalStore();
  const { height: windowHeight } = useWindowDimensions();
  const visible = !!openProductId;

  return (
    <Modal transparent visible={visible} onRequestClose={close} animationType="fade">
      <TouchableWithoutFeedback onPress={close}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
      </TouchableWithoutFeedback>
      <View style={styles.centerWrap} pointerEvents="box-none">
        {openProductId && (
          <View style={[styles.card, { maxHeight: windowHeight * 0.88 }]}>
            <ProductDetailContent productId={openProductId} onClose={close} />
          </View>
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
