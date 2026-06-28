import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Animated, TouchableWithoutFeedback } from 'react-native';
import { Colors, Radius, Typography } from '@/lib/theme';

interface ActionSheetOption {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  options: ActionSheetOption[];
  onCancel: () => void;
}

// Alert.alert's options-array form (used for Android previously) is just as
// invisible on web as the plain confirm form — same root cause as alerts.ts.
// This is the bottom-sheet equivalent, same visual pattern as Save/Share/Invite.
export function ActionSheet({ visible, options, onCancel }: Props) {
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }, [visible]);

  function close(action?: () => void) {
    Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
      onCancel();
      action?.();
    });
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={() => close()} animationType="none">
      <TouchableWithoutFeedback onPress={() => close()}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheetWrap}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />
          {options.map((opt, i) => (
            <Pressable key={i} style={styles.row} onPress={() => close(opt.onPress)}>
              <Text style={[styles.label, opt.destructive && styles.labelDestructive]}>{opt.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancelRow} onPress={() => close()}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet:     { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  row:       { paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
  label:     { ...Typography.headline, fontSize: 16, color: Colors.text },
  labelDestructive: { color: Colors.destructive },
  cancelRow: { paddingVertical: 16, paddingHorizontal: 20, marginTop: 8, alignItems: 'center' },
  cancelLabel: { ...Typography.headline, fontSize: 16, color: Colors.textMuted },
});
