import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Typography, serifTracking } from '@/lib/theme';
import { TroveMark } from './TroveMark';

// Mark + "trove". The word is set in Young Serif for now; a custom-drawn
// wordmark will replace <Wordmark> below, and nothing else needs to change.
const SIZES = {
  sm: { mark: 30, word: 24, gap: Spacing[3] },
  lg: { mark: 56, word: 44, gap: Spacing[4] },
};

interface Props {
  size?: keyof typeof SIZES;
  color?: string;
}

export function TroveLockup({ size = 'sm', color = Colors.text }: Props) {
  const s = SIZES[size];
  return (
    <View style={[styles.row, { gap: s.gap }]} accessible accessibilityRole="image" accessibilityLabel="Trove">
      <TroveMark size={s.mark} color={color} />
      <Wordmark size={s.word} color={color} />
    </View>
  );
}

export function Wordmark({ size, color }: { size: number; color: string }) {
  return (
    <Text
      allowFontScaling={false}
      style={[Typography.wordmark, { fontSize: size, letterSpacing: serifTracking(size), color }]}
    >
      trove
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
