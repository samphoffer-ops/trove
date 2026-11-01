import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { NeverShowStep as Step } from '@/data/products';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { CloseIcon } from '@/components/Icons';

type Excluded = Record<Step['groups'][number]['field'], string[]>;

type Props = {
  step: Step;
  excluded: Excluded;
  onToggle: (field: keyof Excluded, id: string) => void;
};

// Wrapping text pills, no imagery. An excluded pill fills ink with a ×, so it
// reads as "not this" rather than as a chartreuse positive pick.
export function NeverShowStep({ step, excluded, onToggle }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {step.groups.map(group => (
        <View key={group.field} style={styles.group}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.pills}>
            {group.options.map(option => {
              const active = excluded[group.field].includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  onPress={() => onToggle(group.field, option.id)}
                  style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && !active && styles.pillPressed]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Never show ${option.label}`}
                >
                  {active && <CloseIcon color={Colors.bg} size={10} />}
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content:    { paddingHorizontal: Spacing.screen, paddingBottom: Spacing[6] },
  group:      { marginBottom: Spacing[6] },
  groupLabel: { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing[4] },
  pills:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingVertical: Spacing[4], paddingHorizontal: Spacing[5],
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  pillActive:     { backgroundColor: Colors.ink, borderColor: Colors.ink },
  pillPressed:    { backgroundColor: Colors.inkGhost },
  pillText:       { ...Typography.cardTitle, color: Colors.text },
  pillTextActive: { color: Colors.bg },
});
