import { ReactNode, useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Spacing } from '@/lib/theme';

// Mobile-first 2-column masonry, same as before — but on a wide web viewport,
// fixing the column count at 2 is what made cards balloon to ~900px wide.
// This grows the column count with available width instead, so a desktop
// browser shows more products at once (the actual goal — discovery — not
// just "make the cards a sane size").
const CARD_TARGET_WIDTH = 180;
const MAX_COLUMNS = 5;
const MAX_GRID_WIDTH = 1100;

interface Props<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  // Height per unit width (e.g. a product's ratio). When given, each item goes
  // into the shortest column so columns end level; otherwise round-robin.
  itemHeight?: (item: T) => number;
  horizontalPadding?: number;
  gap?: number;
}

export function MasonryGrid<T>({ items, keyExtractor, renderItem, itemHeight, horizontalPadding = Spacing.screen, gap = Spacing.gutter }: Props<T>) {
  const { width } = useWindowDimensions();
  // Web's static export prerenders this in Node (no real window), where
  // useWindowDimensions falls back to a value that never matches a real
  // browser's viewport — baking a different column count into the static
  // HTML than what the client computes on its first render. React treats
  // that as a hydration mismatch, on every single load, not intermittently
  // (confirmed: React error #418 on a fresh page load). Rendering nothing
  // until mounted makes the server output and the client's pre-mount pass
  // identical regardless of Node's fallback width; the real grid appears
  // right after, as an ordinary client-side update instead of a mismatch.
  // Native has no SSR pass, so it skips the gate and renders immediately.
  const [mounted, setMounted] = useState(Platform.OS !== 'web');
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const available = Math.min(width, MAX_GRID_WIDTH) - horizontalPadding * 2;
  const columns = Math.max(2, Math.min(MAX_COLUMNS, Math.floor((available + gap) / (CARD_TARGET_WIDTH + gap))));

  const cols: T[][] = Array.from({ length: columns }, () => []);
  const heights = cols.map(() => 0);
  items.forEach((item, i) => {
    const c = itemHeight ? heights.indexOf(Math.min(...heights)) : i % columns;
    cols[c].push(item);
    if (itemHeight) heights[c] += itemHeight(item);
  });

  return (
    <View style={[styles.grid, { gap, paddingHorizontal: horizontalPadding, maxWidth: MAX_GRID_WIDTH }]}>
      {cols.map((col, i) => (
        <View key={i} style={styles.col}>
          {col.map(item => <View key={keyExtractor(item)}>{renderItem(item)}</View>)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', alignSelf: 'center', width: '100%' },
  col:  { flex: 1 },
});
