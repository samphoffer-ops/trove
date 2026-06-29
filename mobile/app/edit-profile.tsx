import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { notify } from '@/lib/alerts';
import { ChevronLeftIcon } from '@/components/Icons';
import { WebFrame } from '@/components/WebFrame';
import { goBack } from '@/lib/navigation';

const SHOP_FOR_OPTIONS = [
  { id: 'mens',   label: "men's" },
  { id: 'womens', label: "women's" },
  { id: 'unisex', label: 'unisex' },
];

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username,    setUsername]    = useState(profile?.username ?? '');
  const [bio,          setBio]        = useState(profile?.bio ?? '');
  const [shopFor,     setShopFor]     = useState<string[]>(profile?.shop_for ?? []);
  const [saving,       setSaving]     = useState(false);

  function toggleShopFor(id: string) {
    setShopFor(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function save() {
    if (!username.trim()) { notify('Handle required', 'Pick a username to continue.'); return; }
    setSaving(true);
    const { error } = await updateProfile({
      display_name: displayName.trim() || username.trim(),
      username: username.trim().toLowerCase(),
      bio: bio.trim() || null,
      shop_for: shopFor,
    });
    setSaving(false);
    if (error) {
      notify(
        error.includes('duplicate') || error.includes('unique') ? 'That handle is taken' : 'Couldn\'t save',
        error.includes('duplicate') || error.includes('unique') ? 'Try a different username.' : error,
      );
      return;
    }
    goBack('/(tabs)/profile');
  }

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/(tabs)/profile')} hitSlop={8}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>Edit profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={Colors.textMuted}
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>Handle</Text>
        <View style={styles.handleInputWrap}>
          <Text style={styles.handlePrefix}>@</Text>
          <TextInput
            style={styles.handleInput}
            placeholder="username"
            placeholderTextColor={Colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder="A line about your taste, your vibe, whatever you want"
          placeholderTextColor={Colors.textMuted}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          maxLength={160}
        />

        <Text style={styles.label}>Shop for</Text>
        <Text style={styles.sublabel}>Helps tailor what gets surfaced — not your identity, just what you're shopping for.</Text>
        <View style={styles.chipRow}>
          {SHOP_FOR_OPTIONS.map(opt => {
            const active = shopFor.includes(opt.id);
            return (
              <Pressable key={opt.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleShopFor(opt.id)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </ScrollView>
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  topBarTitle: { ...Typography.cardTitle, fontSize: 16, color: Colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  label:   { ...Typography.cardTitle, color: Colors.text, marginTop: Spacing[5], marginBottom: Spacing[3], textTransform: 'lowercase' },
  sublabel:{ ...Typography.caption, fontSize: 12.5, color: Colors.textMuted, marginBottom: Spacing[3], marginTop: -4, lineHeight: 17 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.input,
    paddingHorizontal: 16, paddingVertical: 13, ...Typography.body, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  handleInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.input, backgroundColor: Colors.surface,
    paddingLeft: 16,
  },
  handlePrefix: { ...Typography.cardTitle, fontSize: 15, color: Colors.textMuted },
  handleInput:  { flex: 1, paddingHorizontal: 4, paddingVertical: 13, ...Typography.body, fontSize: 15, color: Colors.text },
  chipRow: { flexDirection: 'row', gap: Spacing[3], flexWrap: 'wrap' },
  chip:    { paddingHorizontal: 15, paddingVertical: 9, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText:   { ...Typography.cardTitle, fontSize: 13.5, color: Colors.textMuted },
  chipTextActive: { color: Colors.accentLime },
  saveBtn: { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', marginTop: Spacing[6] },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...Typography.headline, fontSize: 16, color: Colors.text },
});
