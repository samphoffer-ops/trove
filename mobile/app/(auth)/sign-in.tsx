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
        {/* Wordmark — white on coral */}
        <Logo width={160} color={Colors.bg} underlineColor="rgba(253,252,249,0.45)" />

        <View style={styles.headingWrap}>
          <Text style={styles.heading}>Welcome back.</Text>
          <Text style={styles.sub}>Sign in to your Trove.</Text>
        </View>

        {/* Inputs — dark-tinted glass, not white boxes */}
        <View style={styles.fields}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="rgba(253,252,249,0.45)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="rgba(253,252,249,0.45)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
        </View>

        <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={signIn} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        <Link href="/(auth)/sign-up" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>
              New to Trove? <Text style={styles.linkAccent}>Create an account</Text>
            </Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.accent },
  inner: {
    flex:             1,
    paddingHorizontal: 28,
    justifyContent:   'center',
    gap:              0,
  },
  headingWrap: { marginTop: Spacing[6], marginBottom: Spacing[6] },
  heading: {
    fontFamily:    'Mulish_900Black',
    fontSize:      34,
    letterSpacing: -1,
    lineHeight:    38,
    color:         Colors.bg,
    marginBottom:  Spacing[2],
  },
  sub: {
    ...Typography.body,
    fontSize: 16,
    color:    'rgba(253,252,249,0.65)',
  },
  fields: { gap: Spacing[3], marginBottom: Spacing[5] },
  // Semi-transparent dark inputs — blends with coral rather than fighting it
  input: {
    borderWidth:       1.5,
    borderColor:       'rgba(253,252,249,0.22)',
    borderRadius:      Radius.input,
    paddingHorizontal: 18,
    paddingVertical:   16,
    ...Typography.body,
    fontSize:   15,
    color:      Colors.bg,
    backgroundColor: 'rgba(13,16,53,0.18)',
  },
  btn: {
    backgroundColor: Colors.accentLime,
    borderRadius:    Radius.full,
    paddingVertical: 17,
    alignItems:      'center',
    marginBottom:    Spacing[4],
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily:    'Mulish_800ExtraBold',
    fontSize:      16,
    color:         Colors.text,
    letterSpacing: -0.2,
  },
  link:       { alignItems: 'center', paddingVertical: 8 },
  linkText:   { ...Typography.body, fontSize: 14, color: 'rgba(253,252,249,0.65)' },
  linkAccent: { fontFamily: 'Mulish_700Bold', color: Colors.bg },
});
