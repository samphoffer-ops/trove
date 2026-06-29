import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardStore } from '@/store/useBoardStore';
import { Colors, Radius, Typography, Spacing, Shadows } from '@/lib/theme';
import { Board } from '@/types';
import { PlusIcon } from '@/components/Icons';

export default function BoardsScreen() {
  const insets = useSafeAreaInsets();
  const { boards, fetchBoards, createBoard } = useBoardStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { fetchBoards(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    await createBoard(newName.trim());
    setNewName('');
    setCreating(false);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>boards</Text>
        <Pressable style={styles.newBoardBtn} onPress={() => setCreating(c => !c)} hitSlop={8}>
          <PlusIcon color={Colors.text} size={20} />
        </Pressable>
      </View>

      {creating && (
        <View style={styles.newRow}>
          <TextInput
            style={styles.newInput}
            placeholder="New board name"
            placeholderTextColor={Colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]} onPress={handleCreate} disabled={!newName.trim()}>
            <Text style={styles.createBtnText}>Create</Text>
          </Pressable>
        </View>
      )}

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

export function BoardCard({ board }: { board: Board }) {
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
        <Text style={styles.name} numberOfLines={1}>{board.name}</Text>
        <Text style={styles.count} numberOfLines={1}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  titleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Spacing[3] },
  title:     { ...Typography.display, color: Colors.text },
  newBoardBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  newRow:    { flexDirection: 'row', gap: Spacing[3], paddingHorizontal: 16, paddingBottom: Spacing[3] },
  newInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.input,
    paddingHorizontal: 14, paddingVertical: 11, ...Typography.body, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface,
  },
  createBtn: { backgroundColor: Colors.accentLime, borderRadius: Radius.input, paddingHorizontal: 16, justifyContent: 'center' },
  createBtnDisabled: { opacity: 0.35 },
  createBtnText: { ...Typography.cardTitle, fontSize: 14, color: Colors.text },
  content:   { paddingHorizontal: 16, paddingBottom: 100 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[4] },
  card:      { width: '31%', borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.surface, ...Shadows.card },
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
