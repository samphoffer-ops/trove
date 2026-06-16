import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Modal, Animated, KeyboardAvoidingView, Platform,
  ScrollView, TouchableWithoutFeedback,
} from 'react-native';
import { Image } from 'expo-image';
import { Product } from '@/types';
import { useBoardStore } from '@/store/useBoardStore';
import { Colors, Radius } from '@/lib/theme';
import { CheckIcon } from './Icons';

interface Props {
  product:  Product | null;
  onClose:  () => void;
}

export function SaveSheet({ product, onClose }: Props) {
  const { boards, createBoard, addToBoard, removeFromBoard, fetchBoards } = useBoardStore();
  const [newName, setNewName] = useState('');
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (product) {
      fetchBoards();
      setNewName('');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    }
  }, [product]);

  function close() {
    Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start(onClose);
  }

  async function handleToggle(boardId: string) {
    if (!product) return;
    const board = boards.find(b => b.id === boardId)!;
    const saved = (board.board_items ?? []).some(i => i.product_id === product.id);
    if (saved) await removeFromBoard(boardId, product.id);
    else       await addToBoard(boardId, product);
  }

  async function handleCreate() {
    if (!product || !newName.trim()) return;
    await createBoard(newName.trim(), product);
    setNewName('');
  }

  if (!product) return null;

  return (
    <Modal transparent visible={!!product} onRequestClose={close} animationType="none">
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Save to board</Text>

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

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {boards.length === 0 ? (
              <Text style={styles.empty}>No boards yet — create one above.</Text>
            ) : (
              boards.map(board => {
                const isSaved = (board.board_items ?? []).some(i => i.product_id === product.id);
                const coverItem = (board.board_items ?? [])[0];
                return (
                  <Pressable key={board.id} style={styles.boardRow} onPress={() => handleToggle(board.id)}>
                    <View style={styles.boardCover}>
                      {coverItem ? (
                        <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <View style={styles.boardCoverEmpty} />
                      )}
                    </View>
                    <View style={styles.boardInfo}>
                      <Text style={styles.boardName}>{board.name}</Text>
                      <Text style={styles.boardCount}>{(board.board_items ?? []).length} items</Text>
                    </View>
                    <View style={[styles.check, isSaved && styles.checkActive]}>
                      {isSaved && <CheckIcon />}
                    </View>
                  </Pressable>
                );
              })
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheetWrap:   { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:       '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  title: {
    fontSize: 17, fontWeight: '700', color: Colors.text,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  newRow: {
    flexDirection: 'row', gap: 8,
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.bg,
  },
  createBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.sm,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  createBtnDisabled: { opacity: 0.35 },
  createBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  list:   { paddingHorizontal: 20 },
  empty:  { color: Colors.textMuted, fontSize: 14, paddingVertical: 16 },
  boardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  boardCover: {
    width: 48, height: 48, borderRadius: Radius.sm,
    backgroundColor: Colors.stoneSoft, overflow: 'hidden',
  },
  boardCoverEmpty: { flex: 1, backgroundColor: Colors.stoneSoft },
  boardInfo:  { flex: 1 },
  boardName:  { fontSize: 15, fontWeight: '600', color: Colors.text },
  boardCount: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
});
