import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Product } from '@/types';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { openProduct } from '@/lib/navigation';
import { BookmarkIcon, CloseIcon } from './Icons';

interface Props {
  product: Product;
  saved:   boolean;
  onSave:  (product: Product) => void;
  onNotInterested?: (product: Product) => void;
}

export function ProductCard({ product, saved, onSave, onNotInterested }: Props) {
  return (
    <Pressable style={styles.card} onPress={() => openProduct(product.id)}>
      {/* Image IS the card — no white box wrapper */}
      <View style={[styles.media, { aspectRatio: 1 / product.ratio }]}>
        <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" />

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
