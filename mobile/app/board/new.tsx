import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardStore } from '@/store/useBoardStore';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import * as haptics from '@/lib/haptics';
import { notify } from '@/lib/alerts';

// New-board bottom sheet. Presented as a native iOS form sheet (registered in
// app/_layout.tsx), so the system draws the grabber, glass and keyboard
// avoidance. The root stays transparent to let that glass show.
export default function NewBoardSheet() {
  const insets = useSafeAreaInsets();
  const createBoard = useBoardStore(s => s.createBoard);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  async function handleCreate() {
    if (!trimmed || saving) return;
    setSaving(true);
    const board = await createBoard(trimmed);
    setSaving(false);
    if (!board) { notify('Couldn\'t create board', 'Try again in a moment.'); return; }
    haptics.boardCreated();
    router.back();
  }

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, Spacing[5]) }]}>
      <Text style={styles.title}>New board</Text>
      <TextInput
        style={styles.input}
        placeholder="Summer linen"
        placeholderTextColor={Colors.textMuted}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleCreate}
      />
      <Pressable style={[styles.createBtn, !trimmed && styles.createBtnDisabled]} onPress={handleCreate} disabled={!trimmed || saving}>
        <Text style={styles.createBtnText}>Create</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { paddingHorizontal: Spacing.screen, paddingTop: Spacing[6], gap: Spacing[4] },
  title:     { ...Typography.headline, color: Colors.text },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: 16, paddingVertical: 13, ...Typography.body, color: Colors.text, backgroundColor: Colors.surface,
  },
  createBtn: { backgroundColor: Colors.accent, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.35 },
  createBtnText: { ...Typography.cardTitle, color: Colors.text },
});
