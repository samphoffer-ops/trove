import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { Logo } from '@/components/Logo';
import { notify } from '@/lib/alerts';

export default function SignIn() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) notify('Sign in failed', error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={styles.inner}>
        <Logo width={150} color={Colors.bg} underlineColor={Colors.bg} />
        <Text style={styles.sub}>Discover things worth keeping.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={signIn} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        <Link href="/(auth)/sign-up" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkAccent}>Sign up</Text></Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.accent },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 14 },
  sub:   { ...Typography.body, fontSize: 16, color: 'rgba(255,248,240,0.75)', marginTop: Spacing[3], marginBottom: Spacing[5] },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.input,
    paddingHorizontal: 16, paddingVertical: 14,
    ...Typography.body, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
  },
  btn: {
    backgroundColor: Colors.accentLime, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center', marginTop: 6,
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { ...Typography.headline, fontSize: 16, color: Colors.text },
  link:        { alignItems: 'center', paddingVertical: 8 },
  linkText:    { ...Typography.body, fontSize: 14, color: 'rgba(255,248,240,0.75)' },
  linkAccent:  { fontWeight: '600', color: Colors.bg },
});
