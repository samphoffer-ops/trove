import { View, Text, Pressable, StyleSheet, Platform, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Product } from '@/types';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { openProduct } from '@/lib/navigation';
import { BookmarkIcon, CloseIcon } from './Icons';
import { ImageGallery } from './ImageGallery';

interface Props {
  product: Product;
  saved:   boolean;
  onSave:  (product: Product) => void;
  onNotInterested?: (product: Product) => void;
  onQuickActions?: (product: Product, anchor: { x: number; y: number }) => void;
}

export function ProductCard({ product, saved, onSave, onNotInterested, onQuickActions }: Props) {
  function handleLongPress(e: GestureResponderEvent) {
    if (!onQuickActions) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { pageX, pageY } = e.nativeEvent;
    onQuickActions(product, { x: pageX, y: pageY });
  }

  const photos = [product.image, ...(product.images ?? [])];

  return (
    <Pressable
      style={styles.card}
      onPress={() => openProduct(product.id)}
      onLongPress={handleLongPress}
      delayLongPress={350}
    >
      {/* Image IS the card — no white box wrapper */}
      <View style={[styles.media, { aspectRatio: 1 / product.ratio }]}>
        <ImageGallery images={photos} aspectRatio={1 / product.ratio} />

        <Pressable style={[styles.saveBtn, saved && styles.saveBtnActive]} onPress={() => onSave(product)} hitSlop={12}>
          <BookmarkIcon color={saved ? Colors.accent : '#fff'} filled={saved} size={14} />
        </Pressable>

        {onNotInterested && (
          <Pressable style={styles.dismissBtn} onPress={() => onNotInterested(product)} hitSlop={10}>
            <CloseIcon color="rgba(255,255,255,0.8)" size={10} />
          </Pressable>
        )}
      </View>

      {/* Minimal editorial info — brand link + name + price */}
      <View style={styles.info}>
        {product.brand_id ? (
          <Pressable
            onPress={(e) => { e.stopPropagation(); router.push(`/brand/${product.brand_id}`); }}
            hitSlop={4}
          >
            <Text style={styles.brand}>{product.brand}</Text>
          </Pressable>
        ) : (
          <Text style={styles.brand}>{product.brand}</Text>
        )}
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.price}>${product.price.toFixed(2)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing[3],
  },
  media: {
    width:           '100%',
    borderRadius:    Radius.card,
    overflow:        'hidden',
    backgroundColor: Colors.stoneSoft,
  },
  saveBtn: {
    position:        'absolute',
    top:             10,
    right:           10,
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: 'rgba(13,16,53,0.30)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  saveBtnActive: {
    backgroundColor: 'rgba(13,16,53,0.55)',
  },
  dismissBtn: {
    position:        'absolute',
    top:             10,
    left:            10,
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: 'rgba(13,16,53,0.28)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  info: {
    paddingHorizontal: 2,
    paddingTop:        Spacing[3],
    paddingBottom:     Spacing[1],
  },
  brand: {
    ...Typography.label,
    color:        Colors.accentBlue,
    marginBottom: 3,
  },
  name: {
    ...Typography.cardTitle,
    color:        Colors.text,
    marginBottom: 3,
  },
  price: {
    ...Typography.price,
    color: Colors.textMuted,
  },
});
