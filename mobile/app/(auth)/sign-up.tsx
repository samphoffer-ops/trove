import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { Logo } from '@/components/Logo';
import { notify } from '@/lib/alerts';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function signUp() {
    if (!username.trim()) { notify('Pick a username'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim().toLowerCase(), display_name: username.trim() } },
    });
    if (error) notify('Sign up failed', error.message);
    else notify('Check your email', 'Click the confirmation link to activate your account.');
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={styles.inner}>
        <Logo width={160} color={Colors.bg}  />

        <View style={styles.headingWrap}>
          <Text style={styles.heading}>Join Trove.</Text>
          <Text style={styles.sub}>Discover things worth keeping.</Text>
        </View>

        <View style={styles.fields}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="rgba(253,252,249,0.45)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            textContentType="username"
          />
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
            textContentType="newPassword"
          />
        </View>

        <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={signUp} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create account'}</Text>
        </Pressable>

        <Link href="/(auth)/sign-in" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkAccent}>Sign in</Text>
            </Text>
          </Pressable>
        </Link>

        <Text style={styles.legal}>
          By creating an account you agree to Trove's{' '}
          <Link href="/terms"><Text style={styles.legalLink}>Terms of Service</Text></Link>
          {' '}and{' '}
          <Link href="/privacy-policy"><Text style={styles.legalLink}>Privacy Policy</Text></Link>.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.accent },
  inner: {
    flex:              1,
    paddingHorizontal: 28,
    justifyContent:    'center',
    gap:               0,
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
  input: {
    borderWidth:       1.5,
    borderColor:       'rgba(253,252,249,0.22)',
    borderRadius:      Radius.input,
    paddingHorizontal: 18,
    paddingVertical:   16,
    ...Typography.body,
    fontSize:        15,
    color:           Colors.bg,
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
  legal:      { ...Typography.caption, fontSize: 12, color: 'rgba(253,252,249,0.5)', textAlign: 'center', lineHeight: 18, marginTop: Spacing[4], paddingHorizontal: 8 },
  legalLink:  { fontFamily: 'Mulish_700Bold', color: 'rgba(253,252,249,0.75)' },
});
