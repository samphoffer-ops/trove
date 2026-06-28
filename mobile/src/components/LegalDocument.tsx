import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from './Icons';
import { Colors, Typography, Spacing } from '@/lib/theme';

export interface LegalSection {
  heading: string;
  body: string;
}

interface Props {
  title:     string;
  updated:   string;
  intro:     string;
  sections:  LegalSection[];
}

export function LegalDocument({ title, updated, intro, sections }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>{title}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: {updated}</Text>
        <Text style={styles.paragraph}>{intro}</Text>

        {sections.map(s => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading}>{s.heading}</Text>
            <Text style={styles.paragraph}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  topBarTitle: { ...Typography.cardTitle, fontSize: 16, color: Colors.text },
  content:     { paddingHorizontal: 20, paddingBottom: 80 },
  updated:     { ...Typography.caption, fontSize: 12.5, color: Colors.textMuted, marginBottom: Spacing[4] },
  paragraph:   { ...Typography.body, fontSize: 14.5, lineHeight: 22, color: Colors.text },
  section:     { marginTop: Spacing[5] },
  heading:     { ...Typography.headline, fontSize: 16, color: Colors.text, marginBottom: Spacing[3] },
});
