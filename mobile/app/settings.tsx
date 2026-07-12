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

  // Sam's manually curated picks — run through catalog-intake so they get
  // judged, categorised, and queued for approval in the normal flow.
  const HAND_PICKED_DOMAINS = [
    'foundco.com',           // Profound Co (rebranded to FOUND)
    'shop-jamiehaller.com',  // Jamie Haller
    'bareknuckles.co',       // Bare Knuckles
    'wythe.com',             // Wythe New York
    'uomoclothingcopenhagen.com', // Uomo Clothing Copenhagen
    'manresaclothing.com',   // Manresa
    'fivefourfive.it',       // Fivefourfive
    'manana.co',             // Mañana Surf
    'percivalclo.com',       // Percival Menswear
    'arran-studios.com',     // Arran Studios
    'brothervellies.com',    // Brother Vellies
    'shopdoen.com',          // Doen
    'secondskinltd.com',     // Second Skin LTD
    'california-arts.com',   // California Arts
    'motherdenim.com',       // Mother Denim
  ];

  async function runHandPickedIntake() {
    setAdminRunning(true);
    try {
      // Split into two batches to stay under the Edge Function timeout
      const batch1 = HAND_PICKED_DOMAINS.slice(0, 6);
      const batch2 = HAND_PICKED_DOMAINS.slice(6);

      setAdminStatus(`Intaking batch 1/2 (${batch1.length} brands)…`);
      const { data: r1, error: e1 } = await supabase.functions.invoke('catalog-intake', { body: { domains: batch1 } });
      if (e1) {
        const detail = await (e1 as any).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? e1.message);
      }

      setAdminStatus(`Intaking batch 2/2 (${batch2.length} brands)…`);
      const { data: r2, error: e2 } = await supabase.functions.invoke('catalog-intake', { body: { domains: batch2 } });
      if (e2) {
        const detail = await (e2 as any).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? e2.message);
      }

      const allResults = [...(r1?.results ?? []), ...(r2?.results ?? [])];
      const queued = allResults.filter((r: any) => r.action === 'queued_for_review').length;
      const skipped = allResults.filter((r: any) => r.action?.startsWith('skipped')).length;
      setAdminStatus(`✓ Done — ${queued} queued for review, ${skipped} skipped`);
    } catch (e: any) {
      setAdminStatus(`✗ Hand-picked intake failed: ${e?.message ?? String(e)}`);
    }
    setAdminRunning(false);
  }

  async function runDiscoverAndIntake() {
    setAdminRunning(true);
    try {
      setAdminStatus('Step 1/2 — discovering candidates…');
      const { data: discovered, error: e1 } = await supabase.functions.invoke('discover-brands', { body: {} });
      if (e1) {
        const detail = await (e1 as any).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? e1.message);
      }

      const domains: string[] = (discovered?.candidates ?? []).map((c: any) => c.domain);
      if (domains.length === 0) {
        setAdminStatus('No new candidates found — catalog is up to date.');
        setAdminRunning(false);
        return;
      }

      setAdminStatus(`Step 2/2 — intaking ${domains.length} candidates…`);
      const { data: intook, error: e2 } = await supabase.functions.invoke('catalog-intake', { body: { domains } });
      if (e2) {
        const detail = await (e2 as any).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? e2.message);
      }

      const queued   = (intook?.results ?? []).filter((r: any) => r.action === 'queued_for_review').length;
      const rejected = (intook?.results ?? []).filter((r: any) => r.action?.startsWith('rejected')).length;
      setAdminStatus(`✓ Done — ${queued} queued for review, ${rejected} rejected`);
    } catch (e: any) {
      setAdminStatus(`✗ Discovery failed: ${e?.message ?? String(e)}`);
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
              onPress={runDiscoverAndIntake}
              disabled={adminRunning}
            >
              {adminRunning ? <ActivityIndicator size="small" color={Colors.text} /> : null}
              <Text style={styles.adminBtnText}>Discover new brands</Text>
            </Pressable>

            <Pressable
              style={[styles.adminBtn, adminRunning && styles.adminBtnDisabled]}
              onPress={runHandPickedIntake}
              disabled={adminRunning}
            >
              {adminRunning ? <ActivityIndicator size="small" color={Colors.text} /> : null}
              <Text style={styles.adminBtnText}>Intake hand-picked brands</Text>
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
