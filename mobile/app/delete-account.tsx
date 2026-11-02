import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { Colors, Radius, Typography, Spacing, DisplayScaling } from '@/lib/theme';
import { notify, confirmAction } from '@/lib/alerts';
import { usesSignInWithApple, reauthenticateWithApple } from '@/lib/appleReauth';
import { ChevronLeftIcon } from '@/components/Icons';
import { WebFrame } from '@/components/WebFrame';
import { goBack } from '@/lib/navigation';

// In-app account deletion (App Review Guideline 5.1.1(v)). The list below
// must match what supabase/functions/delete-account removes; keep the two
// in sync.
const WHAT_GOES = [
  { title: 'Your profile', detail: 'Name, username, photo and bio.' },
  { title: 'Your taste profile', detail: 'Onboarding picks, your never-show list, and everything you passed on.' },
  { title: 'Boards and saves', detail: 'Every board you made, its cover and saved items. You leave boards others shared with you.' },
  { title: 'Messages', detail: 'Conversations and shares you sent or received.' },
  { title: 'Follows', detail: 'People and brands you follow, and people who follow you.' },
  { title: 'Activity', detail: 'Your history of views, saves and visits to brand sites.' },
];

type Phase = 'review' | 'deleting' | 'deleted';

export default function DeleteAccount() {
  const insets = useSafeAreaInsets();
  const { user, deleteAccount, signOut } = useAuthStore();
  const [phase, setPhase] = useState<Phase>('review');
  const apple = usesSignInWithApple(user);

  function confirmDelete() {
    confirmAction(
      'Delete your account?',
      'Everything listed will be permanently deleted. This can\'t be undone.',
      'Delete account',
      runDelete,
    );
  }

  async function runDelete() {
    setPhase('deleting');
    let appleCode: string | null = null;
    if (apple) {
      appleCode = await reauthenticateWithApple();
      if (!appleCode) { setPhase('review'); return; }
    }
    const { error } = await deleteAccount(appleCode);
    if (error) {
      setPhase('review');
      notify('Couldn\'t delete account', error);
      return;
    }
    setPhase('deleted');
  }

  const items = apple
    ? [...WHAT_GOES, { title: 'Sign in with Apple', detail: 'Trove\'s access to your Apple ID is revoked.' }]
    : WHAT_GOES;

  return (
    <WebFrame maxWidth={960}>
    {/* No swiping back mid-delete or out of the deleted state. */}
    <Stack.Screen options={{ gestureEnabled: phase === 'review' }} />
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        {phase === 'review' && (
          <Pressable onPress={() => goBack('/settings')} hitSlop={11} accessibilityRole="button" accessibilityLabel="Back">
            <ChevronLeftIcon />
          </Pressable>
        )}
      </View>

      {phase === 'deleted' ? (
        <View style={styles.content}>
          <Text {...DisplayScaling} style={styles.pageLabel} accessibilityRole="header">account deleted</Text>
          <Text style={styles.intro}>
            Your account and everything in it are gone. Thanks for spending time on Trove.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text {...DisplayScaling} style={styles.pageLabel} accessibilityRole="header">delete account</Text>
          <Text style={styles.intro}>
            This permanently deletes your Trove account and everything in it. It can't be undone.
          </Text>

          {items.map(item => (
            <View key={item.title} style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDetail}>{item.detail}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bottom-anchored, in the thumb zone (spec §4). */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
        {phase === 'deleted' ? (
          <Pressable style={styles.btn} onPress={signOut} accessibilityRole="button">
            <Text style={styles.btnText}>Done</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, phase === 'deleting' && styles.btnDisabled]}
            onPress={confirmDelete}
            disabled={phase === 'deleting'}
            accessibilityRole="button"
          >
            {phase === 'deleting' && <ActivityIndicator size="small" color={Colors.text} />}
            <Text style={styles.btnText}>{phase === 'deleting' ? 'Deleting account…' : 'Delete my account'}</Text>
          </Pressable>
        )}
      </View>
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  topBar:      { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: Spacing.screen },
  content:     { paddingHorizontal: Spacing.screen, paddingBottom: Spacing[6] },
  pageLabel:   { ...Typography.displayXl, color: Colors.textMuted, paddingTop: Spacing[4], marginBottom: Spacing[5] },
  intro:       { ...Typography.subhead, color: Colors.text, marginBottom: Spacing[6] },
  row:         { paddingVertical: Spacing[4], borderTopWidth: 1, borderTopColor: Colors.border },
  rowTitle:    { ...Typography.cardTitle, color: Colors.text },
  rowDetail:   { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing[1] },
  footer:      { paddingHorizontal: Spacing.screen, paddingTop: Spacing[4] },
  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[3], backgroundColor: Colors.inkGhost, borderRadius: Radius.pill, paddingVertical: 14 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { ...Typography.cardTitle, color: Colors.text },
});
