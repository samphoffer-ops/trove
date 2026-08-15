import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Typography, Spacing, Shadows } from '@/lib/theme';
import { notify } from '@/lib/alerts';
import { ChevronLeftIcon, CheckIcon, CloseIcon } from '@/components/Icons';
import { WebFrame } from '@/components/WebFrame';
import { goBack, openExternal } from '@/lib/navigation';

interface PendingBrand {
  id: string;
  name: string;
  domain: string;
  platform: string | null;
  judge_confidence: number | null;
  judge_reasoning: string | null;
  matched_categories: string[] | null;
  matched_styles: string[] | null;
  audience: string | null;
  created_at: string;
}

// Admin-only. Gating here is just so a non-admin doesn't see a broken/empty
// screen — the actual security is server-side: catalog-intake's
// list_pending/review_decision actions independently verify the caller's
// session against their real email before returning data or writing
// anything, so this screen can't be used to approve/reject brands even by
// someone who found the route.
const ADMIN_EMAIL = 'samphoffer@gmail.com';

export default function BrandReview() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [brands, setBrands] = useState<PendingBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('catalog-intake', { body: { action: 'list_pending' } });
    if (error) notify('Couldn\'t load review queue', error.message);
    else setBrands(data?.brands ?? []);
    setLoading(false);
  }

  async function decide(brand: PendingBrand, decision: 'approve' | 'reject') {
    setDecidingId(brand.id);
    const { data, error } = await supabase.functions.invoke('catalog-intake', {
      body: { action: 'review_decision', brand_id: brand.id, decision },
    });
    if (error) {
      const detail = await (error as any).context?.json?.().catch(() => null);
      notify('Couldn\'t save decision', detail?.error ?? error.message);
    } else if (data?.error) {
      notify('Couldn\'t save decision', data.error);
    } else {
      // Optimistic removal — this brand is decided, drop it from the list
      // rather than re-fetching the whole queue.
      setBrands(prev => prev.filter(b => b.id !== brand.id));
    }
    setDecidingId(null);
  }

  if (!isAdmin) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.emptyText}>Not available.</Text>
      </View>
    );
  }

  return (
    <WebFrame maxWidth={640}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/settings')} hitSlop={8}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>Brand review</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : brands.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Queue is empty</Text>
            <Text style={styles.emptyText}>Nothing waiting on a decision right now.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.count}>{brands.length} awaiting review</Text>
            {brands.map(brand => (
              <View key={brand.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Pressable onPress={() => openExternal(`https://${brand.domain}`)}>
                    <Text style={styles.name}>{brand.name}</Text>
                    <Text style={styles.domain}>{brand.domain} ↗</Text>
                  </Pressable>
                  {brand.judge_confidence != null && (
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>{brand.judge_confidence}</Text>
                    </View>
                  )}
                </View>

                {(!!brand.matched_categories?.length || !!brand.matched_styles?.length) && (
                  <View style={styles.chipRow}>
                    {[...(brand.matched_categories ?? []), ...(brand.matched_styles ?? [])].map(tag => (
                      <View key={tag} style={styles.chip}>
                        <Text style={styles.chipText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {brand.judge_reasoning && <Text style={styles.reasoning}>{brand.judge_reasoning}</Text>}

                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => decide(brand, 'reject')}
                    disabled={decidingId === brand.id}
                  >
                    <CloseIcon color={Colors.destructive} size={14} />
                    <Text style={[styles.actionText, { color: Colors.destructive }]}>Reject</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => decide(brand, 'approve')}
                    disabled={decidingId === brand.id}
                  >
                    {decidingId === brand.id
                      ? <ActivityIndicator size="small" color={Colors.text} />
                      : <CheckIcon color={Colors.text} size={14} />}
                    <Text style={styles.actionText}>Approve</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.footnote}>
              Approved brands get their products scraped in the next daily refresh — not instantly.
            </Text>
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
  count:       { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing[4] },

  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { ...Typography.headline, color: Colors.text, marginBottom: Spacing[3] },
  emptyText:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.card,
    padding:         Spacing[4],
    marginBottom:    Spacing[4],
    ...Shadows.card,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing[3] },
  name:        { ...Typography.headline, fontSize: 16, color: Colors.text },
  domain:      { ...Typography.caption, color: Colors.accentBlue, marginTop: 2 },
  confidenceBadge: {
    minWidth: 30, height: 22, paddingHorizontal: 6, borderRadius: 11,
    backgroundColor: Colors.inkGhost, alignItems: 'center', justifyContent: 'center',
  },
  confidenceText: { ...Typography.caption, fontSize: 11, color: Colors.textMuted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing[3] },
  chip:      { backgroundColor: Colors.bg, borderRadius: Radius.badge, paddingHorizontal: 8, paddingVertical: 4 },
  chipText:  { ...Typography.label, color: Colors.textMuted },

  reasoning: { ...Typography.body, fontSize: 13, color: Colors.textMuted, marginTop: Spacing[3], lineHeight: 19 },

  actionRow: { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[4] },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: Radius.input, paddingVertical: 12,
  },
  rejectBtn:  { backgroundColor: Colors.bg },
  approveBtn: { backgroundColor: Colors.accentLime },
  actionText: { ...Typography.cardTitle, fontSize: 13, color: Colors.text },

  footnote: { ...Typography.caption, color: Colors.textLight, textAlign: 'center', marginTop: Spacing[3] },
});
