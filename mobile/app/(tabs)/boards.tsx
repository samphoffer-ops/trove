import { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardStore } from '@/store/useBoardStore';
import { Colors, Radius } from '@/lib/theme';
import { Board } from '@/types';

export default function BoardsScreen() {
  const insets = useSafeAreaInsets();
  const { boards, fetchBoards } = useBoardStore();

  useEffect(() => { fetchBoards(); }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Boards</Text>
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
  const coverProductId = board.cover_product_id ?? items[0]?.product_id;

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/board/${board.id}`)}>
      <View style={styles.cover}>
        {coverProductId ? (
          <Image
            source={{ uri: `https://loremflickr.com/400/400/${coverProductId}` }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={styles.coverEmpty} />
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
  title:     { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  content:   { paddingHorizontal: 16, paddingBottom: 100 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card:      { width: '47%', borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.surface, shadowColor: '#1E1C1A', shadowOffset: { width:0, height:1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cover:     { width: '100%', aspectRatio: 1, backgroundColor: Colors.stoneSoft },
  coverEmpty:{ flex: 1, backgroundColor: Colors.stoneSoft },
  info:      { padding: 10 },
  name:      { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  count:     { fontSize: 12, color: Colors.textMuted },
  empty:     { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle:{ fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 21 },
});
