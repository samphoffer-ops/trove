import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Product } from '@/types';
import { usePriceFormatter } from '@/store/useCurrencyStore';
import { Colors, Radius, Typography, Spacing, Animation } from '@/lib/theme';
import { openProduct } from '@/lib/navigation';
import * as haptics from '@/lib/haptics';
import { BookmarkIcon } from './Icons';

interface Props {
  product: Product;
  saved:   boolean;
  onSave:  (product: Product) => void;
  onQuickActions?: (product: Product, anchor: { x: number; y: number }) => void;
}

// Image, brand and price only (docs/design-spec.md §7 Feed). "Not for me"
// lives in the long-press menu; the save icon is the visible fallback.
export function ProductCard({ product, saved, onSave, onQuickActions }: Props) {
  const formatPrice = usePriceFormatter();
  // Start from the stored ratio so the grid lays out before images arrive,
  // then switch to the image's own dimensions: images are shown exactly as
  // scraped, never cropped to a ratio that's off (intake falls back to 1.25).
  const [aspectRatio, setAspectRatio] = useState(1 / product.ratio);

  function handleLongPress(e: GestureResponderEvent) {
    if (!onQuickActions) return;
    haptics.quickActionsOpen();
    const { pageX, pageY } = e.nativeEvent;
    onQuickActions(product, { x: pageX, y: pageY });
  }

  return (
    <Pressable
      style={styles.card}
      onPress={() => openProduct(product.id)}
      onLongPress={handleLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${product.brand}, ${formatPrice(product)}`}
      accessibilityHint="Long-press for Save or Not for me"
    >
      <View style={[styles.media, { aspectRatio }]}>
        {/* #55: shared-transition tag goes on this Image */}
        <Image
          source={{ uri: product.image }}
          style={styles.image}
          contentFit="contain"
          transition={Animation.micro}
          recyclingKey={product.id}
          onLoad={({ source }) => {
            if (source.width && source.height) setAspectRatio(source.width / source.height);
          }}
        />

        <Pressable
          style={[styles.saveBtn, saved && styles.saveBtnActive]}
          onPress={() => { haptics.saveToBoard(); onSave(product); }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Saved' : 'Save'}
        >
          <BookmarkIcon color={saved ? Colors.accent : '#fff'} filled={saved} size={14} />
        </Pressable>
      </View>

      <View style={styles.info}>
        {product.brand_id ? (
          <Pressable
            style={styles.brandLink}
            onPress={(e) => { e.stopPropagation(); router.push(`/brand/${product.brand_id}`); }}
            hitSlop={4}
          >
            <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.brand, styles.brandLink]} numberOfLines={1}>{product.brand}</Text>
        )}
        <Text style={styles.price}>{formatPrice(product)}</Text>
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
  image: {
    width:  '100%',
    height: '100%',
  },
  saveBtn: {
    position:        'absolute',
    top:             Spacing[3],
    right:           Spacing[3],
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(13,16,53,0.30)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  saveBtnActive: {
    backgroundColor: 'rgba(13,16,53,0.55)',
  },
  info: {
    flexDirection:     'row',
    alignItems:        'baseline',
    gap:               Spacing[3],
    paddingHorizontal: 2,
    paddingTop:        Spacing[2],
  },
  brandLink: {
    flexShrink: 1,
  },
  brand: {
    ...Typography.label,
    color: Colors.accentBlue,
  },
  price: {
    ...Typography.price,
    color:      Colors.textMuted,
    marginLeft: 'auto',
  },
});
