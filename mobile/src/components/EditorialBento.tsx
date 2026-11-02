import { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useReducedMotion, interpolate, Extrapolation } from 'react-native-reanimated';
import { Product } from '@/types';
import { Colors, Typography, Spacing, DisplayScaling } from '@/lib/theme';
import { ProductCard } from './ProductCard';

// How far the stacked column drifts against the lead product while the block
// crosses the screen. Subtle on purpose (docs/design-spec.md §5).
const PARALLAX_DRIFT = 14;
const MAX_WIDTH = 1100;

interface Props {
  title:    string;
  products: Product[];               // 3: lead, then the two stacked
  scrollY:  SharedValue<number>;     // feed scroll offset
  isSaved:  (id: string) => boolean;
  onSave:   (product: Product) => void;
  onQuickActions: (product: Product, anchor: { x: number; y: number }) => void;
}

// Editorial bento block (§7 Feed): an oversized italic header naming the
// mini-edit, one lead product at ~60% width and two stacked beside it.
// Breaks the grid on purpose. Must be a direct child of the feed's scroll
// content so its layout y is a scroll offset.
export function EditorialBento({ title, products, scrollY, isSaved, onSave, onQuickActions }: Props) {
  const { height: screenH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [blockY, setBlockY] = useState(0);
  const [lead, ...stacked] = products;

  function handleLayout(e: LayoutChangeEvent) {
    setBlockY(e.nativeEvent.layout.y);
  }

  // Images themselves are never transformed; the stacked column moves as a
  // whole, from +drift as the block enters to -drift as it leaves.
  const stackedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ translateY: 0 }] };
    const translateY = interpolate(
      scrollY.value,
      [blockY - screenH, blockY + screenH * 0.5],
      [PARALLAX_DRIFT, -PARALLAX_DRIFT],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY }] };
  });

  return (
    <View style={styles.block} onLayout={handleLayout}>
      <Text {...DisplayScaling} style={styles.title} accessibilityRole="header">{title}</Text>
      <View style={styles.row}>
        <View style={styles.lead}>
          <ProductCard product={lead} saved={isSaved(lead.id)} onSave={onSave} onQuickActions={onQuickActions} />
        </View>
        <Animated.View style={[styles.stacked, stackedStyle]}>
          {stacked.map(p => (
            <ProductCard key={p.id} product={p} saved={isSaved(p.id)} onSave={onSave} onQuickActions={onQuickActions} />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width:             '100%',
    maxWidth:          MAX_WIDTH,
    alignSelf:         'center',
    paddingHorizontal: Spacing.screen,
    paddingTop:        Spacing[6],
    paddingBottom:     Spacing[6],
  },
  title: {
    ...Typography.displayXl,
    color:        Colors.text,
    marginBottom: Spacing[5],
    marginLeft:   -2,   // optical: italic overhang
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           Spacing.gutter,
  },
  lead:    { flex: 3 },
  stacked: { flex: 2 },
});
