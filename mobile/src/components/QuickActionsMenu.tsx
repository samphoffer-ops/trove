import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Animated, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Typography, Shadows, Animation } from '@/lib/theme';

export interface QuickAction {
  key:     string;
  label:   string;
  icon:    (color: string) => React.ReactNode;
  onPress: () => void;
}

interface Props {
  anchor:    { x: number; y: number } | null;  // page coords of the long-press
  actions:   QuickAction[];
  onDismiss: () => void;
}

const BUTTON = 46;
const GAP = 14;
const PAD_H = 10;
const PAD_TOP = 8;
const LABEL_HEIGHT = 14;

// Pinterest-style long-press menu — a small pill of icon buttons that pops
// in right where the finger landed, not a bottom sheet. Dismisses on tap
// anywhere outside it, and on selecting an action.
export function QuickActionsMenu({ anchor, actions, onDismiss }: Props) {
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0)).current;
  const visible = !!anchor;

  useEffect(() => {
    if (visible) {
      scale.setValue(0);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...Animation.spring }).start();
    }
  }, [visible]);

  if (!anchor) return null;

  const pillWidth  = actions.length * BUTTON + (actions.length - 1) * GAP + PAD_H * 2;
  const pillHeight = BUTTON + LABEL_HEIGHT + PAD_TOP + PAD_H;
  const margin = 12;

  const left = Math.min(Math.max(anchor.x - pillWidth / 2, margin), screenW - pillWidth - margin);
  const showAbove = anchor.y - pillHeight - margin > insets.top;
  const top = showAbove ? anchor.y - pillHeight - margin : anchor.y + margin;

  function select(action: QuickAction) {
    onDismiss();
    action.onPress();
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.pill,
          { left, top, width: pillWidth },
          { transform: [{ scale }], opacity: scale },
        ]}
      >
        {actions.map(action => (
          <Pressable key={action.key} style={styles.item} onPress={() => select(action)} hitSlop={4}>
            <View style={styles.btn}>{action.icon(Colors.text)}</View>
            <Text style={styles.label} numberOfLines={1}>{action.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pill: {
    position:        'absolute',
    flexDirection:   'row',
    gap:             GAP,
    paddingHorizontal: PAD_H,
    paddingTop:      PAD_TOP,
    paddingBottom:   PAD_H,
    backgroundColor: Colors.surface,
    borderRadius:    Radius.card,
    ...Shadows.elevated,
  },
  item:  { alignItems: 'center' },
  btn: {
    width:           BUTTON,
    height:          BUTTON,
    borderRadius:    BUTTON / 2,
    backgroundColor: Colors.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  label: {
    ...Typography.label,
    color:     Colors.textMuted,
    marginTop: 4,
  },
});
