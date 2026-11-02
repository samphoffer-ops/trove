import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardStore } from '@/store/useBoardStore';
import { Colors, Radius, Typography, Spacing, DisplayScaling } from '@/lib/theme';
import { Board } from '@/types';
import { PlusIcon } from '@/components/Icons';
import { GlassHeader, GLASS_HEADER_HEIGHT } from '@/components/GlassHeader';
import { BoardBento } from '@/components/BoardBento';

// Board creation is the formSheet route at app/board/new.tsx (spec §4:
// secondary flows open as bottom sheets).
function openCreateSheet() {
  router.push('/board/new');
}

export default function BoardsScreen() {
  const insets = useSafeAreaInsets();
  const { boards, fetchBoards } = useBoardStore();
  // Hold the empty state back until the first fetch settles, so a user with
  // boards never sees "Start a board" flash on launch.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { fetchBoards().finally(() => setLoaded(true)); }, []);

  const empty = loaded && boards.length === 0;
  // Content starts below the floating glass header, then scrolls under it.
  const headerInset = insets.top + GLASS_HEADER_HEIGHT;

  const titleRow = (
    <View style={styles.titleRow}>
      <Text {...DisplayScaling} style={styles.pageLabel}>boards</Text>
      {!empty && (
        <Pressable style={styles.newBoardBtn} onPress={openCreateSheet} hitSlop={8} accessibilityLabel="New board">
          <PlusIcon color={Colors.text} size={20} />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {empty ? (
        <View style={{ flex: 1, paddingTop: headerInset }}>
          {titleRow}
          <View style={[styles.empty, { paddingBottom: insets.bottom + 100 }]}>
            <View>
              <Text {...DisplayScaling} style={styles.emptyTitle}>Start a board</Text>
              <Text style={styles.emptyBody}>Group the pieces you save. Each board's cover builds itself from its first four.</Text>
            </View>
            <Pressable style={styles.createBtn} onPress={openCreateSheet}>
              <Text style={styles.createBtnText}>Create board</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: headerInset }} showsVerticalScrollIndicator={false} scrollsToTop={true}>
          {titleRow}
          <View style={styles.content}>
            {boards.map(board => <BoardCard key={board.id} board={board} />)}
          </View>
        </ScrollView>
      )}

      {/* After the content so it draws on top */}
      <GlassHeader />
    </View>
  );
}

export function BoardCard({ board, style }: { board: Board; style?: object }) {
  return (
    <Pressable style={style} onPress={() => router.push(`/board/${board.id}`)}>
      <BoardBento board={board} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{board.name}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: Spacing.screen, paddingBottom: Spacing[5] },
  pageLabel: { ...Typography.displayXl, color: Colors.textMuted },
  newBoardBtn: { marginTop: Spacing[4], width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  // One full-width bento per board; capped on wide web viewports.
  content:   { paddingHorizontal: Spacing.screen, paddingBottom: 100, gap: Spacing[6], maxWidth: 560, alignSelf: 'center', width: '100%' },
  info:      { paddingTop: Spacing[3] },
  name:      { ...Typography.cardTitle, color: Colors.text },
  // Copy top-left, the one action in the thumb zone.
  empty:     { flex: 1, justifyContent: 'space-between', paddingHorizontal: Spacing.screen, paddingTop: Spacing[6] },
  emptyTitle:{ ...Typography.display, color: Colors.text, marginBottom: Spacing[4] },
  emptyBody: { ...Typography.body, color: Colors.textMuted, maxWidth: 300 },
  createBtn: { backgroundColor: Colors.accent, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  createBtnText: { ...Typography.cardTitle, color: Colors.text },
});
