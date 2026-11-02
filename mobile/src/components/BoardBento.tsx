import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Board } from '@/types';
import { Colors, Radius, Typography, Spacing, Animation, DisplayScaling } from '@/lib/theme';

// A board's cover, built from its first four saves (design-spec §7 Boards):
// one tall tile at 2/3 width, the rest stacked on the right. Fewer saves
// collapse the layout (1 = full, 2 = halves, 3 = tall + two). An uploaded
// cover_image_url is a deliberate override and replaces the bento.
// Images are framed with contentFit="cover" only — never otherwise altered.

const MAX_TILES = 4;

function coverImages(board: Board): string[] {
  const items = board.board_items ?? [];
  // A chosen cover product leads the bento; the rest keep save order.
  const lead = items.find(i => i.product_id === board.cover_product_id);
  const ordered = lead ? [lead, ...items.filter(i => i !== lead)] : items;
  return ordered
    .map(i => i.product_data?.image)
    .filter((uri): uri is string => !!uri)
    .slice(0, MAX_TILES);
}

function Tile({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={styles.tile}
      contentFit="cover"
      transition={Animation.micro}
    />
  );
}

export function BoardBento({ board }: { board: Board }) {
  if (board.cover_image_url) {
    return (
      <View style={styles.frame}>
        <Tile uri={board.cover_image_url} />
      </View>
    );
  }

  const [lead, ...rest] = coverImages(board);

  if (!lead) {
    return (
      <View style={[styles.frame, styles.empty]}>
        {/* Shrink rather than break a word mid-way in narrow tiles (profile's
            two-column grid): a one-word name gets one line. */}
        <Text
          {...DisplayScaling}
          style={styles.emptyName}
          numberOfLines={board.name.trim().includes(' ') ? 2 : 1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {board.name}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={rest.length > 1 ? styles.leadWide : styles.leadHalf}>
        <Tile uri={lead} />
      </View>
      {rest.length > 0 && (
        <View style={styles.stack}>
          {rest.map((uri, i) => <Tile key={i} uri={uri} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 5:4 overall puts the lead tile near 4:5 portrait, the usual product frame.
  frame:     { width: '100%', aspectRatio: 5 / 4, flexDirection: 'row', gap: Spacing.bento, borderRadius: Radius.card, overflow: 'hidden' },
  leadWide:  { flex: 2 },
  leadHalf:  { flex: 1 },
  stack:     { flex: 1, gap: Spacing.bento },
  tile:      { flex: 1, backgroundColor: Colors.stoneSoft },
  empty:     { backgroundColor: Colors.stoneSoft, flexDirection: 'column', justifyContent: 'flex-end', padding: Spacing[5] },
  emptyName: { ...Typography.display, color: Colors.textMuted },
});
