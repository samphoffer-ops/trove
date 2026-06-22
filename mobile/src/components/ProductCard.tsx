import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Product } from '@/types';
import { Colors, Radius } from '@/lib/theme';
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
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.price}>${product.price.toFixed(2)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:    Radius.md,
    overflow:        'hidden',
    backgroundColor: Colors.surface,
    marginBottom:    12,
    shadowColor:     '#1E1C1A',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.04,
    shadowRadius:    3,
    elevation:       1,
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
    padding: 11,
  },
  brand: {
    fontSize:      10.5,
    fontWeight:    '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color:         Colors.textMuted,
    marginBottom:  3,
  },
  name: {
    fontSize:     13.5,
    fontWeight:   '600',
    color:        Colors.text,
    marginBottom: 5,
    lineHeight:   18,
  },
  price: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.accentBlue,
  },
});
