import { View, Text, StyleSheet } from 'react-native';
import { MarketingLayout } from '@/components/MarketingLayout';
import { PhoneMockup } from '@/components/PhoneMockup';
import { Colors, Typography } from '@/lib/theme';

const SECTIONS = [
  {
    eyebrow: 'Discover',
    headline: 'A feed that earns your trust.',
    body: 'The more you use Trove, the better it gets. Every save, every tap, every skip teaches it something new about your taste. No noise. No dropshippers. Just things you’ll actually want.',
    image: require('../assets/screenshots/feed.png'),
  },
  {
    eyebrow: 'Save & Organize',
    headline: 'Shop with purpose.',
    body: 'Save products to boards built around real life — a trip coming up, a room you’re designing, an occasion worth dressing for. Your finds finally have a home.',
    image: require('../assets/screenshots/boards.png'),
  },
  {
    eyebrow: 'Share',
    headline: 'Shopping is better together.',
    body: 'Send a product to a friend, build a board together, or plan a purchase around a shared moment. Trove brings the fun back to finding things.',
    image: require('../assets/screenshots/board-detail.png'),
  },
];

export default function Features() {
  return (
    <MarketingLayout>
      <View style={styles.intro}>
        <Text style={styles.introHeadline}>Built around how you actually shop.</Text>
      </View>

      {SECTIONS.map((s, i) => (
        <View key={s.eyebrow} style={[styles.row, i % 2 === 1 && styles.rowReverse]}>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>{s.eyebrow}</Text>
            <Text style={styles.headline}>{s.headline}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
          <View style={styles.visual}>
            <PhoneMockup width={220} source={s.image} />
          </View>
        </View>
      ))}
    </MarketingLayout>
  );
}

const styles = StyleSheet.create({
  intro: { paddingTop: 56, paddingBottom: 24 },
  introHeadline: { fontFamily: Typography.display.fontFamily, fontSize: 36, color: Colors.text, letterSpacing: -0.7, maxWidth: 600 },
  row: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    gap: 40, paddingVertical: 48, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  copy: { flex: 1, minWidth: 300, gap: 14 },
  eyebrow: { fontFamily: Typography.label.fontFamily, fontSize: 13, color: Colors.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
  headline: { fontFamily: Typography.display.fontFamily, fontSize: 30, color: Colors.text, letterSpacing: -0.5, lineHeight: 36 },
  body: { ...Typography.body, fontSize: 16, color: Colors.textMuted, lineHeight: 25, maxWidth: 440 },
  visual: { flex: 1, minWidth: 220, alignItems: 'center' },
});
