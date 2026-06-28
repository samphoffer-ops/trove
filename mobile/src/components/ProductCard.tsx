import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Product } from '@/types';
import { Colors, Radius, Typography, Spacing, Shadows } from '@/lib/theme';
import { BookmarkIcon, CloseIcon } from './Icons';

interface Props {
  product: Product;
  saved:   boolean;
  onSave:  (product: Product) => void;
  onNotInterested?: (product: Product) => void;
}

export function ProductCard({ product, saved, onSave, onNotInterested }: Props) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/product/${product.id}`)}>
      <View style={[styles.media, { aspectRatio: 1 / product.ratio }]}>
        <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {onNotInterested && (
          <Pressable style={styles.dismissBtn} onPress={() => onNotInterested(product)} hitSlop={8}>
            <CloseIcon color={Colors.text} size={12} />
          </Pressable>
        )}
        <Pressable style={styles.saveBtn} onPress={() => onSave(product)} hitSlop={8}>
          <BookmarkIcon color={saved ? Colors.accent : Colors.text} filled={saved} size={16} />
        </Pressable>
      </View>
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
    borderRadius:    Radius.card,
    overflow:        'hidden',
    backgroundColor: Colors.surface,
    marginBottom:    Spacing[4],
    ...Shadows.card,
  },
  media: {
    width:           '100%',
    backgroundColor: Colors.stoneSoft,
  },
  saveBtn: {
    position:        'absolute',
    top:             8,
    right:           8,
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  dismissBtn: {
    position:        'absolute',
    top:             8,
    left:            8,
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  info: {
    padding: Spacing[4],
  },
  brand: {
    ...Typography.label,
    color:        Colors.textMuted,
    marginBottom: Spacing[1],
  },
  name: {
    ...Typography.cardTitle,
    color:        Colors.text,
    marginBottom: Spacing[1],
  },
  price: {
    ...Typography.cardTitle,
    color: Colors.accentBlue,
  },
});
