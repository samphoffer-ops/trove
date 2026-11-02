import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardStore } from '@/store/useBoardStore';
import { useSaveSheetStore } from '@/store/useSaveSheetStore';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { CheckIcon, CloseIcon } from '@/components/Icons';
import * as haptics from '@/lib/haptics';

// Save to Board bottom sheet. Presented as a native iOS form sheet (registered
// in app/_layout.tsx) with medium/large detents, so the system draws the
// grabber, glass, drag-to-dismiss and keyboard avoidance. The root stays
// transparent to let that glass show. Open it with openSaveSheet(product).
export default function SaveSheet() {
  const insets = useSafeAreaInsets();
  const product = useSaveSheetStore(s => s.product);
  const { boards, createBoard, addToBoard, removeFromBoard, fetchBoards } = useBoardStore();
  const [newName, setNewName] = useState('');
  const closing = useRef(false);

  useEffect(() => {
    fetchBoards();
    return () => useSaveSheetStore.getState().setProduct(null);
  }, []);

  function close() {
    if (closing.current) return;
    closing.current = true;
    router.back();
  }

  async function handleToggle(boardId: string) {
    if (!product) return;
    const board = boards.find(b => b.id === boardId)!;
    const saved = (board.board_items ?? []).some(i => i.product_id === product.id);
    if (saved) {
      haptics.onboardingSelect();
      await removeFromBoard(boardId, product.id);
    } else {
      haptics.saveToBoard();
      await addToBoard(boardId, product);
      // Brief pause so the checkmark fill is visible before the sheet dismisses —
      // tapping a board is a complete "save" action, not a multi-select staging area.
      setTimeout(close, 400);
    }
  }

  async function handleCreate() {
    if (!product || !newName.trim()) return;
    const board = await createBoard(newName.trim(), product);
    if (board) haptics.boardCreated();
    setNewName('');
  }

  if (!product) return null;

  return (
    // react-native-screens lays out a form sheet holding a scroll view from
    // exactly two direct children, header then ScrollView; collapsable keeps
    // the header from being flattened away.
    <>
      <View collapsable={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Save to board</Text>
          <Pressable onPress={close} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
            <CloseIcon color={Colors.textMuted} size={16} />
          </Pressable>
        </View>

        <View style={styles.newRow}>
          <TextInput
            style={styles.input}
            placeholder="New board name"
            placeholderTextColor={Colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable
            style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!newName.trim()}
          >
            <Text style={styles.createBtnText}>Create</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, Spacing[5]) }}
        keyboardShouldPersistTaps="handled"
      >
        {boards.length === 0 ? (
          <Text style={styles.empty}>No boards yet — create one above.</Text>
        ) : (
          boards.map(board => {
            const isSaved = (board.board_items ?? []).some(i => i.product_id === product.id);
            const coverItem = (board.board_items ?? [])[0];
            const coverImage = board.cover_image_url ?? coverItem?.product_data?.image;
            return (
              <Pressable
                key={board.id}
                style={({ pressed }) => [styles.boardRow, pressed && styles.boardRowPressed]}
                onPress={() => handleToggle(board.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSaved }}
              >
                <View style={styles.boardCover}>
                  {coverImage ? (
                    <Image source={{ uri: coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={styles.boardCoverEmpty} />
                  )}
                </View>
                <View style={styles.boardInfo}>
                  <Text style={styles.boardName}>{board.name}</Text>
                </View>
                <View style={[styles.check, isSaved && styles.checkActive]}>
                  {isSaved && <CheckIcon color={Colors.text} />}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen, paddingTop: Spacing[6], paddingBottom: Spacing[4],
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { ...Typography.headline, color: Colors.text },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  newRow: {
    flexDirection: 'row', gap: Spacing[3],
    paddingVertical: 16, paddingHorizontal: Spacing.screen, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 12,
    ...Typography.body, color: Colors.text, backgroundColor: Colors.bg,
  },
  createBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.full,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  createBtnDisabled: { opacity: 0.35 },
  createBtnText:     { ...Typography.cardTitle, color: Colors.text },
  list:   { flex: 1, paddingHorizontal: Spacing.screen },
  empty:  { ...Typography.body, color: Colors.textMuted, paddingVertical: 16 },
  boardRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[4], paddingVertical: Spacing[3],
  },
  boardRowPressed: { opacity: 0.6 },
  boardCover: {
    width: 48, height: 48, borderRadius: Radius.input,
    backgroundColor: Colors.stoneSoft, overflow: 'hidden',
  },
  boardCoverEmpty: { flex: 1, backgroundColor: Colors.stoneSoft },
  boardInfo:  { flex: 1 },
  boardName:  { ...Typography.cardTitle, color: Colors.text },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { backgroundColor: Colors.accentLime, borderColor: Colors.accentLime },
});
