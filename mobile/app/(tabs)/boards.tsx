import { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardStore } from '@/store/useBoardStore';
import { Colors, Radius, Typography, Spacing, Shadows } from '@/lib/theme';
import { Board } from '@/types';

export default function BoardsScreen() {
  const insets = useSafeAreaInsets();
  const { boards, fetchBoards } = useBoardStore();

  useEffect(() => { fetchBoards(); }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Text style={styles.title}>boards</Text>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {boards.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No boards yet</Text>
            <Text style={styles.emptyBody}>Save products from your feed to start organizing them.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {boards.map(board => <BoardCard key={board.id} board={board} />)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function BoardCard({ board }: { board: Board }) {
  const items = board.board_items ?? [];
  const coverItem = items.find(i => i.product_id === board.cover_product_id) ?? items[0];
  const coverImage = board.cover_image_url ?? coverItem?.product_data?.image;
  const collaborators = board.board_collaborators ?? [];

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/board/${board.id}`)}>
      <View style={styles.cover}>
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={styles.coverEmpty} />
        )}
        {collaborators.length > 0 && (
          <View style={styles.avatarStack}>
            {collaborators.slice(0, 3).map(c => (
              <View key={c.id} style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(c.profiles?.display_name ?? c.profiles?.username ?? '?')[0].toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{board.name}</Text>
        <Text style={styles.count}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  title:     { ...Typography.display, color: Colors.text, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Spacing[3] },
  content:   { paddingHorizontal: 16, paddingBottom: 100 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[5] },
  card:      { width: '47%', borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.surface, ...Shadows.card },
  cover:     { width: '100%', aspectRatio: 1, backgroundColor: Colors.stoneSoft },
  coverEmpty:{ flex: 1, backgroundColor: Colors.stoneSoft },
  avatarStack: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row' },
  avatar: {
    width: 24, height: 24, borderRadius: 12, marginLeft: -8,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  avatarText: { ...Typography.label, color: '#fff' },
  info:      { padding: Spacing[3] },
  name:      { ...Typography.cardTitle, color: Colors.text, marginBottom: Spacing[1] },
  count:     { ...Typography.caption, color: Colors.textMuted },
  empty:     { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle:{ ...Typography.headline, color: Colors.text, marginBottom: Spacing[3] },
  emptyBody: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
