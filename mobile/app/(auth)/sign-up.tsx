import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Radius } from '@/lib/theme';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function signUp() {
    if (!username.trim()) { Alert.alert('Pick a username'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim().toLowerCase(), display_name: username.trim() } },
    });
    if (error) Alert.alert('Sign up failed', error.message);
    else Alert.alert('Check your email', 'Click the confirmation link to activate your account.');
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={styles.inner}>
        <Text style={styles.logo}>trove</Text>
        <Text style={styles.sub}>Create your account.</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={Colors.textMuted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          textContentType="username"
        />
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
          textContentType="newPassword"
        />

        <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={signUp} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create account'}</Text>
        </Pressable>

        <Link href="/(auth)/sign-in" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkAccent}>Sign in</Text></Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 14 },
  logo:  { fontSize: 42, fontWeight: '800', color: Colors.accent, letterSpacing: -1, marginBottom: 4 },
  sub:   { fontSize: 16, color: Colors.textMuted, marginBottom: 20 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
  },
  btn: {
    backgroundColor: Colors.accent, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center', marginTop: 6,
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  link:        { alignItems: 'center', paddingVertical: 8 },
  linkText:    { fontSize: 14, color: Colors.textMuted },
  linkAccent:  { color: Colors.accent, fontWeight: '600' },
});
