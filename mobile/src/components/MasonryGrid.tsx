import { ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

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
  horizontalPadding?: number;
  gap?: number;
}

export function MasonryGrid<T>({ items, keyExtractor, renderItem, horizontalPadding = 16, gap = 12 }: Props<T>) {
  const { width } = useWindowDimensions();
  const available = Math.min(width, MAX_GRID_WIDTH) - horizontalPadding * 2;
  const columns = Math.max(2, Math.min(MAX_COLUMNS, Math.floor((available + gap) / (CARD_TARGET_WIDTH + gap))));

  const cols: T[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, i) => cols[i % columns].push(item));

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
