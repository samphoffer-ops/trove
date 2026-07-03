import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, Spacing } from '@/lib/theme';
import { notify, confirmAction } from '@/lib/alerts';
import { ChevronLeftIcon } from '@/components/Icons';
import { WebFrame } from '@/components/WebFrame';
import { goBack } from '@/lib/navigation';

const ADMIN_EMAIL = 'samphoffer@gmail.com';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { signOut, deleteAccount, user } = useAuthStore();
  const [deleting, setDeleting] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [adminRunning, setAdminRunning] = useState(false);
  const isAdmin = user?.email === ADMIN_EMAIL;

  async function runAdminAction(fn: string, body: Record<string, unknown>, label: string) {
    setAdminRunning(true);
    setAdminStatus(`Running ${label}…`);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      const count = data?.found_new ?? data?.results?.length ?? data?.refreshed ?? '—';
      setAdminStatus(`✓ ${label} done — ${count} items`);
    } catch (e: any) {
      setAdminStatus(`✗ ${label} failed: ${e?.message ?? String(e)}`);
    }
    setAdminRunning(false);
  }

  function confirmSignOut() {
    confirmAction('Sign out', 'Are you sure?', 'Sign out', signOut);
  }

  function confirmDeleteAccount() {
    confirmAction(
      'Delete account',
      'This permanently deletes your profile, boards, saved items, and social connections. This can\'t be undone.',
      'Continue',
      confirmDeleteAccountFinal,
    );
  }

  function confirmDeleteAccountFinal() {
    confirmAction(
      'Are you absolutely sure?',
      'There is no way to recover your account after this.',
      'Delete my account',
      async () => {
        setDeleting(true);
        const { error } = await deleteAccount();
        setDeleting(false);
        if (error) notify('Couldn\'t delete account', error);
      },
    );
  }

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/(tabs)/profile')} hitSlop={8}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.linkRow} onPress={() => router.push('/edit-profile')}>
          <Text style={styles.linkText}>Edit profile</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.linkRow} onPress={() => router.push('/privacy-policy')}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => router.push('/terms')}>
          <Text style={styles.linkText}>Terms of Service</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.signOutBtn} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={confirmDeleteAccount} disabled={deleting}>
          <Text style={styles.deleteText}>{deleting ? 'Deleting account…' : 'Delete account'}</Text>
        </Pressable>

        {isAdmin && (
          <>
            <View style={styles.divider} />
            <Text style={styles.adminHeading}>Admin</Text>

            <Pressable
              style={[styles.adminBtn, adminRunning && styles.adminBtnDisabled]}
              onPress={() => runAdminAction('catalog-intake', { action: 'refresh_all' }, 'Product refresh')}
              disabled={adminRunning}
            >
              {adminRunning ? <ActivityIndicator size="small" color={Colors.text} /> : null}
              <Text style={styles.adminBtnText}>Refresh all products</Text>
            </Pressable>

            <Pressable
              style={[styles.adminBtn, adminRunning && styles.adminBtnDisabled]}
              onPress={() => runAdminAction('discover-brands', {}, 'Brand discovery')}
              disabled={adminRunning}
            >
              {adminRunning ? <ActivityIndicator size="small" color={Colors.text} /> : null}
              <Text style={styles.adminBtnText}>Discover new brands</Text>
            </Pressable>

            {adminStatus && <Text style={styles.adminStatus}>{adminStatus}</Text>}
          </>
        )}
      </ScrollView>
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  topBarTitle: { ...Typography.cardTitle, fontSize: 16, color: Colors.text },
  content:     { paddingHorizontal: 20, paddingBottom: 100 },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: Spacing[6] },
  linkRow:     { paddingVertical: Spacing[3] },
  linkText:    { ...Typography.body, fontSize: 15, color: Colors.text },
  deleteBtn:   { paddingVertical: 14, alignItems: 'center', marginTop: Spacing[1] },
  deleteText:  { ...Typography.cardTitle, color: Colors.textMuted },
  signOutBtn:  { paddingVertical: 14, alignItems: 'center' },
  signOutText: { ...Typography.body, fontSize: 15, fontWeight: '600', color: Colors.destructive },

  adminHeading:    { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing[3], letterSpacing: 0.5 },
  adminBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.inkGhost, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, marginBottom: Spacing[3] },
  adminBtnDisabled:{ opacity: 0.5 },
  adminBtnText:    { ...Typography.body, fontSize: 14, color: Colors.text },
  adminStatus:     { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing[2], lineHeight: 18 },
});
