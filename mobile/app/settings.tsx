import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
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
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Accepts a bare domain or a full pasted URL (with protocol, www, a path,
  // query string...) and reduces it to what catalog-intake expects.
  function extractDomain(input: string): string {
    let s = input.trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
    s = s.split('/')[0].split('?')[0];
    return s;
  }

  async function quickAddBrand() {
    const domain = extractDomain(quickAddUrl);
    if (!domain) return;
    setAdminRunning(true);
    setAdminStatus(`Adding ${domain}…`);
    try {
      // auto_approve, same as the hand-picked list below — this is Sam
      // vouching for a specific brand himself, not something to run past
      // the AI judge first. Also flips hand_picked on the row, so it feeds
      // the hand-picked similarity search layer in discover-brands too.
      const { data, error } = await supabase.functions.invoke('catalog-intake', {
        body: { domains: [domain], auto_approve: true },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      setAdminStatus(result ? `✓ ${domain}: ${result.action}` : `✓ ${domain} submitted`);
      setQuickAddUrl('');
    } catch (e: any) {
      setAdminStatus(`✗ ${domain} failed: ${e?.message ?? String(e)}`);
    }
    setAdminRunning(false);
  }

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
    'vitosnewyork.com',         // Vito's New York
    'pearledivory.com',         // Pearled Ivory
    'amundsen.com',             // Amundsen Sports
    'freepeople.com',           // Free People
    'freemanssportingclub.com', // Freeman's Sporting Club
    'freeagencynewyork.com',    // Free Agency New York
    'houseoferrors.org',        // House of Errors
    'omtcnyc.com',               // Original Madras Trading Company
    'essexandthewhale.com',      // Essex and the Whale
    'jpress.com',                 // J. Press
    // 'Osh Manufacturing' -- couldn't confidently find a real domain for
    // this one (only match was OshKosh B'gosh, an unrelated kids-apparel
    // company), so it's left out until Sam confirms the actual site.
    'beachwood.com',        // Beachwood
    'morrisandking.com',    // Morris & King
    'literarysport.com',    // Literary Sport
    'wooden-sleepers.com',  // Wooden Sleepers
    'ghiaiacashmere.com',   // Ghiaia Cashmere
    'sonder.haus',          // Sønderhaus Studios (spelled "sonder.haus" — the ø doesn't appear in the domain)
    'drakes.com',           // Drake's
    'mutimer.co',           // Mutimer
  ];

  // Runs domains through catalog-intake in batches small enough to stay
  // under the Edge Function's execution limit (MAX_DOMAINS_PER_RUN=15
  // server-side) — sending more than that in one call used to mean
  // anything past the first 15 was silently dropped with no indication,
  // not queued, not retried, just gone. Both admin actions below hit this:
  // the hand-picked list only avoided it by luck (fewer than 15 per fixed
  // half), and "Discover new brands" hit it on nearly every real run,
  // since discovery usually finds 30-70 candidates in one pass.
  async function intakeInBatches(domains: string[], autoApprove: boolean, onProgress: (done: number, total: number) => void) {
    const BATCH_SIZE = 10;
    const allResults: any[] = [];
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE);
      onProgress(i, domains.length);
      const { data, error } = await supabase.functions.invoke('catalog-intake', {
        body: { domains: batch, ...(autoApprove ? { auto_approve: true } : {}) },
      });
      if (error) {
        const detail = await (error as any).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? error.message);
      }
      allResults.push(...(data?.results ?? []));
    }
    return allResults;
  }

  async function runHandPickedIntake() {
    setAdminRunning(true);
    try {
      const allResults = await intakeInBatches(HAND_PICKED_DOMAINS, true, (done, total) =>
        setAdminStatus(`Intaking ${done}/${total} brands…`));

      const approved = allResults.filter((r: any) => r.action === 'auto_approved').length;
      const skipped = allResults.filter((r: any) => r.action?.startsWith('skipped')).length;
      const totalProducts = allResults.reduce((n: number, r: any) => n + (r.count ?? 0), 0);
      setAdminStatus(`✓ Done — ${approved} brands approved, ${totalProducts} products added, ${skipped} skipped`);
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

      const allResults = await intakeInBatches(domains, false, (done, total) =>
        setAdminStatus(`Step 2/2 — intaking ${done}/${total} candidates…`));

      const queued   = allResults.filter((r: any) => r.action === 'queued_for_review').length;
      const rejected = allResults.filter((r: any) => r.action?.startsWith('rejected')).length;
      setAdminStatus(`✓ Done — ${queued} queued for review, ${rejected} rejected (${domains.length} total candidates)`);
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
    <WebFrame maxWidth={960}>
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

            <View style={styles.quickAddRow}>
              <TextInput
                style={styles.quickAddInput}
                placeholder="Paste a brand's URL to add it"
                placeholderTextColor={Colors.textMuted}
                value={quickAddUrl}
                onChangeText={setQuickAddUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={quickAddBrand}
              />
              <Pressable
                style={[styles.quickAddBtn, (!quickAddUrl.trim() || adminRunning) && styles.adminBtnDisabled]}
                onPress={quickAddBrand}
                disabled={!quickAddUrl.trim() || adminRunning}
              >
                <Text style={styles.quickAddBtnText}>Add</Text>
              </Pressable>
            </View>

            <Pressable style={styles.adminBtn} onPress={() => router.push('/brand-review')}>
              <Text style={styles.adminBtnText}>Review pending brands</Text>
            </Pressable>

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
  quickAddRow:     { flexDirection: 'row', gap: Spacing[2], marginBottom: Spacing[4] },
  quickAddInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: 16, paddingVertical: 12, ...Typography.body, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface,
  },
  quickAddBtn:     { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingHorizontal: 20, justifyContent: 'center' },
  quickAddBtnText: { ...Typography.cardTitle, fontSize: 14, color: Colors.text },
  adminBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.inkGhost, borderRadius: Radius.full, paddingVertical: 14, paddingHorizontal: 16, marginBottom: Spacing[3] },
  adminBtnDisabled:{ opacity: 0.5 },
  adminBtnText:    { ...Typography.body, fontSize: 14, color: Colors.text },
  adminStatus:     { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing[2], lineHeight: 18 },
});
