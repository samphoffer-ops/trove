import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Typography, Spacing, Shadows } from '@/lib/theme';
import { Logo } from '@/components/Logo';
import { GoogleIcon, AppleIcon } from '@/components/Icons';
import { notify } from '@/lib/alerts';

export default function SignIn() {
  const insets = useSafeAreaInsets();
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
    <View style={styles.root}>
      <Image source={require('../../assets/sign-in-background.jpeg')} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={['rgba(13,16,53,0.55)', 'rgba(13,16,53,0)']}
        locations={[0, 0.28]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.frame, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.card}>
          <Logo width={132} color={Colors.text} />

          <View style={styles.headingWrap}>
            <Text style={styles.heading}>Welcome back.</Text>
            <Text style={styles.sub}>Sign in to your Trove.</Text>
          </View>

          <View style={styles.fields}>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.textLight}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
            />
          </View>

          <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={signIn} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.oauthGroup}>
            <Pressable style={styles.oauthBtn}>
              <GoogleIcon size={16} />
              <Text style={styles.oauthText}>Sign in with Google</Text>
            </Pressable>
            <Pressable style={styles.oauthBtn}>
              <AppleIcon color={Colors.text} size={15} />
              <Text style={styles.oauthText}>Sign in with Apple</Text>
            </Pressable>
          </View>
        </View>

        <Link href="/(auth)/sign-up" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>
              New to Trove? <Text style={styles.linkAccent}>Create an account</Text>
            </Text>
          </Pressable>
        </Link>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ink },
  frame: {
    flex:             1,
    paddingHorizontal: 24,
    justifyContent:   'flex-end',
  },
  card: {
    backgroundColor: Colors.bg,
    borderRadius:    28,
    paddingHorizontal: 26,
    paddingTop:      36,
    paddingBottom:   28,
    alignItems:      'center',
    ...Shadows.phone,
  },
  headingWrap: { alignItems: 'center', marginTop: Spacing[4], marginBottom: Spacing[5] },
  heading: {
    fontFamily:    'Mulish_900Black',
    fontSize:      26,
    letterSpacing: -0.6,
    lineHeight:    30,
    color:         Colors.text,
    marginBottom:  Spacing[1],
  },
  sub: {
    ...Typography.body,
    fontSize: 14,
    color:    Colors.textMuted,
  },
  fields: { width: '100%', gap: Spacing[2], marginBottom: Spacing[4] },
  input: {
    width:             '100%',
    borderRadius:      Radius.full,
    paddingHorizontal: 20,
    paddingVertical:   14,
    ...Typography.body,
    fontSize:        14,
    color:           Colors.text,
    backgroundColor: Colors.stoneSoft,
  },
  btn: {
    width:           '100%',
    backgroundColor: Colors.ink,
    borderRadius:    Radius.full,
    paddingVertical: 15,
    alignItems:      'center',
    marginBottom:    Spacing[5],
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily:    'Mulish_800ExtraBold',
    fontSize:      15,
    color:         Colors.bg,
    letterSpacing: -0.1,
  },
  dividerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginBottom: Spacing[4] },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { ...Typography.caption, fontSize: 12, color: Colors.textMuted },
  oauthGroup: { width: '100%', gap: Spacing[2] },
  oauthBtn: {
    width:           '100%',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    paddingVertical: 12,
    borderRadius:    Radius.full,
    borderWidth:     1,
    borderColor:     Colors.border,
    backgroundColor: Colors.surface,
  },
  oauthText: { fontFamily: 'Mulish_700Bold', fontSize: 13.5, color: Colors.text },
  link:       { alignItems: 'center', paddingTop: Spacing[5] },
  linkText:   {
    ...Typography.body,
    fontSize: 14,
    color:    'rgba(253,252,249,0.75)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  linkAccent: { fontFamily: 'Mulish_700Bold', color: Colors.bg },
});
