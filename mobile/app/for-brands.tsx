import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { MarketingLayout } from '@/components/MarketingLayout';
import { PhoneMockup } from '@/components/PhoneMockup';
import { supabase } from '@/lib/supabase';
import { Colors, Radius } from '@/lib/theme';

const PITCH = [
  'A quality-curated feed — Trove only surfaces brands that match the bar, not the highest bidder.',
  'High-intent shoppers — people on Trove are actively looking for products that match their taste.',
  'Affiliate-based — no upfront cost to your brand. You only pay when someone actually buys.',
];

export default function ForBrands() {
  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    if (!brandName.trim() || !website.trim() || !email.trim()) {
      Alert.alert('A few fields are missing', 'Brand name, website, and contact email are required.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('brand_inquiries').insert({
      brand_name: brandName.trim(),
      website: website.trim(),
      category: category.trim() || null,
      contact_email: email.trim(),
      description: description.trim() || null,
    });
    setSubmitting(false);
    if (error) { Alert.alert('Something went wrong', 'Please try again in a moment.'); return; }
    setSubmitted(true);
  }

  return (
    <MarketingLayout>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.headline}>Your next loyal customer is already looking for you.</Text>
          <Text style={styles.sub}>Trove puts your products in front of high-intent shoppers whose taste profile matches what you make. No ads. No noise. Just the right people.</Text>
        </View>
        <PhoneMockup width={220} source={require('../assets/screenshots/product-detail.png')} />
      </View>

      <View style={styles.pitchList}>
        {PITCH.map(item => (
          <View key={item} style={styles.pitchRow}>
            <View style={styles.pitchDot} />
            <Text style={styles.pitchText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formHeadline}>Get your products in front of the right people</Text>

        {submitted ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>Thanks — we'll be in touch soon.</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Brand name" placeholderTextColor={Colors.textMuted} value={brandName} onChangeText={setBrandName} />
            <TextInput style={styles.input} placeholder="Website" placeholderTextColor={Colors.textMuted} value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
            <TextInput style={styles.input} placeholder="Category (fashion, home, beauty…)" placeholderTextColor={Colors.textMuted} value={category} onChangeText={setCategory} />
            <TextInput style={styles.input} placeholder="Contact email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us a bit about your brand"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
            <Pressable style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={submit} disabled={submitting}>
              <Text style={styles.submitBtnText}>{submitting ? 'Sending…' : 'Get your products in front of the right people'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </MarketingLayout>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 40, paddingTop: 56, paddingBottom: 48 },
  heroCopy: { flex: 1, minWidth: 320, gap: 16 },
  headline: { fontSize: 36, fontWeight: '800', color: Colors.text, letterSpacing: -0.6, lineHeight: 42 },
  sub: { fontSize: 16.5, color: Colors.textMuted, lineHeight: 26, maxWidth: 440 },
  pitchList: { gap: 16, paddingVertical: 32, borderTopWidth: 1, borderTopColor: Colors.border, maxWidth: 620 },
  pitchRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pitchDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginTop: 7 },
  pitchText: { fontSize: 16, color: Colors.text, lineHeight: 24, flex: 1 },
  formSection: { paddingVertical: 48, borderTopWidth: 1, borderTopColor: Colors.border, maxWidth: 540 },
  formHeadline: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4, marginBottom: 24 },
  form: { gap: 12 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center', paddingHorizontal: 12 },
  successBox: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 24 },
  successText: { fontSize: 16, fontWeight: '600', color: Colors.text },
});
