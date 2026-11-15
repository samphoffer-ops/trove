import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShareStore } from '@/store/useShareStore';
import { ChevronLeftIcon, SearchIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing, DisplayScaling } from '@/lib/theme';
import { Share } from '@/types';
import { WebFrame } from '@/components/WebFrame';
import { goBack } from '@/lib/navigation';

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function InboxList() {
  const insets = useSafeAreaInsets();
  const { inbox, fetchInbox } = useShareStore();
  const [query, setQuery] = useState('');

  useEffect(() => { fetchInbox(); }, []);

  // Group shares by sender — each entry is one conversation thread
  const conversations = useMemo(() => {
    const groups = new Map<string, { shares: Share[]; profile: Share['profiles'] }>();
    for (const share of inbox) {
      if (!groups.has(share.sender_id)) {
        groups.set(share.sender_id, { shares: [], profile: share.profiles });
      }
      groups.get(share.sender_id)!.shares.push(share);
    }
    return Array.from(groups.entries())
      .map(([senderId, { shares, profile }]) => {
        const sorted = [...shares].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return {
          senderId,
          profile,
          latest: sorted[0],
          unread: sorted.filter(s => !s.read_at).length,
        };
      })
      .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
  }, [inbox]);

  const filtered = query.trim()
    ? conversations.filter(c => {
        const name = (c.profile?.display_name ?? c.profile?.username ?? '').toLowerCase();
        return name.includes(query.toLowerCase());
      })
    : conversations;

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/(tabs)/feed')} hitSlop={11} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeftIcon />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Same oversized page title as Boards and Settings: the screen's editorial moment (spec §1) */}
        <Text {...DisplayScaling} style={styles.pageLabel} accessibilityRole="header">messages</Text>

        {inbox.length > 0 && (
          <View style={styles.searchWrap}>
            <SearchIcon color={Colors.textMuted} size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        )}

        {filtered.length === 0 ? (
          inbox.length === 0 ? (
            <View style={styles.empty}>
              <Text {...DisplayScaling} style={styles.emptyTitle}>Nothing yet</Text>
              <Text style={styles.emptyBody}>When a friend shares a product with you, it'll show up here.</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>No conversations matching "{query}"</Text>
            </View>
          )
        ) : (
          filtered.map(convo => {
            const name = convo.profile?.display_name ?? convo.profile?.username ?? 'Someone';
            const initial = name[0].toUpperCase();
            const unread = convo.unread > 0;
            // product_data is null for text-only replies (migration 017), so
            // the latest message isn't guaranteed to carry a product.
            const product = convo.latest.product_data;
            const preview = convo.latest.message
              ? convo.latest.message
              : product ? `${product.brand} · ${product.name}` : '';
            return (
              <Pressable
                key={convo.senderId}
                style={styles.row}
                onPress={() => router.push({ pathname: '/inbox/[userId]', params: { userId: convo.senderId, name } })}
                accessibilityRole="button"
                accessibilityLabel={`${name}${unread ? `, ${convo.unread} unread` : ''}, ${preview}`}
              >
                <View style={styles.avatar}>
                  {convo.profile?.avatar_url ? (
                    <Image source={{ uri: convo.profile.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Text style={styles.avatarText}>{initial}</Text>
                  )}
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={unread ? styles.nameUnread : styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.time}>{timeAgo(convo.latest.created_at)}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>{preview}</Text>
                    {/* Unread counts stay in 1.0 (Sam, 2026-11-02), overriding spec §9 */}
                    {unread && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{convo.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {/* Shown as scraped: contained in its frame, never cropped */}
                {product && <Image source={{ uri: product.image }} style={styles.thumb} contentFit="contain" />}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
    </WebFrame>
  );
}

const AVATAR = 48;

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  topBar:      { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: Spacing.screen },
  content:     { paddingHorizontal: Spacing.screen, paddingBottom: 100 },
  pageLabel:   { ...Typography.displayXl, color: Colors.text, paddingTop: Spacing[4], marginBottom: Spacing[6] },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    marginBottom: Spacing[4],
    paddingHorizontal: Spacing[4], height: 40,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, ...Typography.body, color: Colors.text },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[4],
    paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  avatarText:  { ...Typography.headline, color: Colors.surface },
  info:        { flex: 1, gap: Spacing[1] },
  nameRow:     { flexDirection: 'row', alignItems: 'baseline', gap: Spacing[3] },
  name:        { ...Typography.body, color: Colors.text, flexShrink: 1 },
  nameUnread:  { ...Typography.cardTitle, color: Colors.text, flexShrink: 1 },
  time:        { ...Typography.caption, color: Colors.textMuted, marginLeft: 'auto' },
  previewRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  preview:     { ...Typography.caption, color: Colors.textMuted, flex: 1 },
  previewUnread: { color: Colors.text },
  badge: {
    minWidth: 20, height: 20, borderRadius: Radius.pill, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing[2],
  },
  badgeText:   { ...Typography.price, color: Colors.surface },
  // 4:5 frame, the feed's ratio; the image is contained inside it.
  thumb:       { width: 40, height: 50, borderRadius: Radius.card, backgroundColor: Colors.stoneSoft, flexShrink: 0 },

  // Copy top-left, like the Boards empty state.
  empty:       { paddingTop: Spacing[5] },
  emptyTitle:  { ...Typography.display, color: Colors.text, marginBottom: Spacing[4] },
  emptyBody:   { ...Typography.body, color: Colors.textMuted, maxWidth: 300 },
});
