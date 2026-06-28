import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { MarketingLayout } from '@/components/MarketingLayout';
import { Colors, Radius, Typography } from '@/lib/theme';

const CONTACT_EMAIL = 'hello@shoptrove.app';

export default function Contact() {
  return (
    <MarketingLayout>
      <View style={styles.section}>
        <Text style={styles.headline}>Say hello</Text>
        <Text style={styles.body}>
          Questions, feedback, press, or just want to talk taste — we'd love to hear from you.
        </Text>
        <Pressable style={styles.emailBtn} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
          <Text style={styles.emailBtnText}>{CONTACT_EMAIL}</Text>
        </Pressable>
      </View>
    </MarketingLayout>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 64, paddingBottom: 80, gap: 18, maxWidth: 520 },
  headline: { fontFamily: Typography.display.fontFamily, fontSize: 36, color: Colors.text, letterSpacing: -0.6 },
  body: { ...Typography.body, fontSize: 16.5, color: Colors.textMuted, lineHeight: 26 },
  emailBtn: { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 15, alignSelf: 'flex-start', marginTop: 8 },
  emailBtnText: { ...Typography.headline, fontSize: 15.5, color: Colors.text },
});
