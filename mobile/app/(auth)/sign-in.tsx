import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Typography, Spacing, DisplayScaling } from '@/lib/theme';
import { Logo } from '@/components/Logo';
import { GoogleIcon } from '@/components/Icons';
import { notify } from '@/lib/alerts';
import { isAppleSignInAvailable, loadAppleAuth, signInWithApple } from '@/lib/appleAuth';

// HIG minimum touch target; the system Apple button is drawn at this height.
const APPLE_BUTTON_HEIGHT = 48;

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  // False on web and anywhere the system Apple sheet isn't available.
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) notify('Sign in failed', error.message);
    setLoading(false);
  }

  const AppleAuthentication = appleAvailable ? loadAppleAuth()?.AppleAuthentication : undefined;

  async function appleSignIn() {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithApple();
    } catch (e: any) {
      notify('Sign in with Apple failed', e?.message);
    }
    setLoading(false);
  }

  return (
    <View style={styles.root}>
      <Image source={require('../../assets/sign-in-background.jpeg')} style={StyleSheet.absoluteFill} contentFit="cover" />
      {/* Flat ink band keeps the status bar legible over the photo (§9: no gradients) */}
      <View style={[styles.statusBand, { height: insets.top }]} />

      {/* Starts below the status bar, so with the keyboard up the card scrolls
          inside the safe area instead of sliding under the Dynamic Island.
          Tapping outside the fields dismisses the keyboard. */}
      <ScrollView
        style={{ marginTop: insets.top }}
        contentContainerStyle={[styles.frame, { paddingTop: 40, paddingBottom: insets.bottom + 24 }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Logo width={132} color={Colors.text} />

          <View style={styles.headingWrap}>
            <Text {...DisplayScaling} style={styles.heading}>Welcome back.</Text>
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
            {/* The system button, per Apple's HIG: Apple draws the logo, label
                and colors, and it leads the group so no other option is
                more prominent. */}
            {AppleAuthentication && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={APPLE_BUTTON_HEIGHT / 2}
                style={styles.appleBtn}
                onPress={appleSignIn}
              />
            )}
            <Pressable style={styles.oauthBtn}>
              <GoogleIcon size={16} />
              <Text style={styles.oauthText}>Sign in with Google</Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ink },
  statusBand: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: Colors.ink },
  frame: {
    flexGrow:         1,
    paddingHorizontal: Spacing.screen,
    justifyContent:   'flex-end',
  },
  card: {
    backgroundColor: Colors.bg,
    borderRadius:    28,
    paddingHorizontal: 26,
    paddingTop:      36,
    paddingBottom:   28,
    alignItems:      'center',
  },
  headingWrap: { alignItems: 'center', marginTop: Spacing[4], marginBottom: Spacing[5] },
  heading: {
    ...Typography.display,
    color:         Colors.text,
    marginBottom:  Spacing[1],
  },
  sub: {
    ...Typography.body,
    color:    Colors.textMuted,
  },
  fields: { width: '100%', gap: Spacing[2], marginBottom: Spacing[4] },
  input: {
    width:             '100%',
    borderRadius:      Radius.full,
    paddingHorizontal: 20,
    paddingVertical:   14,
    ...Typography.body,
    color:           Colors.text,
    backgroundColor: Colors.stoneSoft,
  },
  btn: {
    width:           '100%',
    backgroundColor: Colors.accent,
    borderRadius:    Radius.full,
    paddingVertical: 15,
    alignItems:      'center',
    marginBottom:    Spacing[5],
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    ...Typography.cardTitle,
    color: Colors.text,
  },
  dividerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginBottom: Spacing[4] },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { ...Typography.caption, color: Colors.textMuted },
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
  appleBtn:  { width: '100%', height: APPLE_BUTTON_HEIGHT },
  oauthText: { ...Typography.cardTitle, color: Colors.text },
  link:       { alignItems: 'center', paddingTop: Spacing[5] },
  linkText:   {
    ...Typography.body,
    color:    'rgba(253,252,249,0.75)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  linkAccent: { fontFamily: Typography.cardTitle.fontFamily, color: Colors.bg },
});
