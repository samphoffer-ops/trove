import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors, Typography, Spacing, DisplayScaling, Animation } from '@/lib/theme';
import { ChevronLeftIcon } from '@/components/Icons';

type Props = {
  number: number;
  title: string;
  subtitle: string;
  progress: number; // 0–1 across the whole flow
  onBack?: () => void;
};

// Back chevron and a thin progress rule, then an oversized pale step numeral
// with the italic title tucked up under it: the step's editorial moment.
export function StepHeader({ number, title, subtitle, progress, onBack }: Props) {
  const fill = useSharedValue(progress);
  useEffect(() => { fill.value = withTiming(progress, { duration: Animation.standard }); }, [progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View>
      <View style={styles.topBar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={11} accessibilityRole="button" accessibilityLabel="Back">
            <ChevronLeftIcon color={Colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        >
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </View>

      <Text {...DisplayScaling} style={styles.numeral} accessible={false}>
        {String(number).padStart(2, '0')}
      </Text>
      <Text {...DisplayScaling} style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:     { flexDirection: 'row', alignItems: 'center', gap: Spacing[5], paddingHorizontal: Spacing.screen, height: 44 },
  backSpacer: { width: 22 },
  track:      { flex: 1, height: 2, backgroundColor: Colors.border, overflow: 'hidden' },
  fill:       { height: 2, backgroundColor: Colors.accent },
  numeral:    { ...Typography.displayXl, color: Colors.textLight, paddingHorizontal: Spacing.screen, marginTop: Spacing[5] },
  title:      { ...Typography.display, color: Colors.text, paddingHorizontal: Spacing.screen, paddingRight: Spacing.screen * 2, marginTop: -Spacing[3] },
  subtitle:   { ...Typography.subhead, color: Colors.textMuted, paddingHorizontal: Spacing.screen, marginTop: Spacing[3], marginBottom: Spacing[5] },
});
