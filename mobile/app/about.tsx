import { View, Text, StyleSheet } from 'react-native';
import { MarketingLayout } from '@/components/MarketingLayout';
import { Colors, Radius } from '@/lib/theme';

export default function About() {
  return (
    <MarketingLayout>
      <View style={styles.section}>
        <Text style={styles.eyebrow}>Our story</Text>
        <Text style={styles.headline}>Why Trove exists</Text>

        <Text style={styles.paragraph}>
          We built Trove because we kept having the same problem. We'd know exactly what we were looking for — the
          aesthetic, the feel, the vibe — but not where to find it. Hours lost scrolling through noise, settling for
          something close enough.
        </Text>
        <Text style={styles.paragraph}>
          Trove is the answer we wanted. A shopping feed that actually learns your taste and brings you brands you
          didn't know existed. Curated, intentional, and built to get better every time you use it.
        </Text>

        <View style={styles.missionCard}>
          <Text style={styles.missionLabel}>Our mission</Text>
          <Text style={styles.missionText}>
            Trove exists to connect people with brands they'll love but haven't found yet.
          </Text>
        </View>
      </View>

      <View style={[styles.section, styles.teamSection]}>
        <Text style={styles.eyebrow}>The team</Text>
        <View style={styles.teamCard}>
          <View style={styles.teamAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName}>Founder bio coming soon</Text>
            <Text style={styles.teamBody}>
              Photo, name, and a short bio go here — add a LinkedIn link too. Even a single founder listed here
              adds real legitimacy for anyone checking whether Trove is a real company.
            </Text>
          </View>
        </View>
      </View>
    </MarketingLayout>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 56, paddingBottom: 48, maxWidth: 640 },
  eyebrow: { fontSize: 13, fontWeight: '800', color: Colors.accent, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  headline: { fontSize: 34, fontWeight: '800', color: Colors.text, letterSpacing: -0.6, marginBottom: 22 },
  paragraph: { fontSize: 16.5, color: Colors.textMuted, lineHeight: 27, marginBottom: 16 },
  missionCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 24, marginTop: 24 },
  missionLabel: { fontSize: 12.5, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  missionText: { fontSize: 19, fontWeight: '700', color: Colors.text, lineHeight: 27, letterSpacing: -0.3 },
  teamSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 40 },
  teamCard: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  teamAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.stoneSoft },
  teamName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  teamBody: { fontSize: 14.5, color: Colors.textMuted, lineHeight: 22, maxWidth: 440 },
});
