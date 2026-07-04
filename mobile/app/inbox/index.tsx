import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShareStore } from '@/store/useShareStore';
import { ChevronLeftIcon, SearchIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
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
        <Pressable onPress={() => goBack('/(tabs)/feed')} hitSlop={8}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>Direct Messages</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            {inbox.length === 0 ? (
              <>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyBody}>When a friend shares a product with you, it'll show up here.</Text>
              </>
            ) : (
              <Text style={styles.emptyBody}>No conversations matching "{query}"</Text>
            )}
          </View>
        ) : (
          filtered.map(convo => {
            const name = convo.profile?.display_name ?? convo.profile?.username ?? 'Someone';
            const initial = name[0].toUpperCase();
            const preview = convo.latest.message
              ? `"${convo.latest.message}"`
              : `${convo.latest.product_data.brand} · ${convo.latest.product_data.name}`;
            return (
              <Pressable
                key={convo.senderId}
                style={styles.row}
                onPress={() => router.push({ pathname: `/inbox/${convo.senderId}`, params: { name } })}
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
                    <Text style={[styles.name, convo.unread > 0 && styles.nameBold]}>{name}</Text>
                    <Text style={styles.time}>{timeAgo(convo.latest.created_at)}</Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
                </View>
                {convo.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{convo.unread}</Text>
                  </View>
                )}
                <Image source={{ uri: convo.latest.product_data.image }} style={styles.thumb} contentFit="cover" />
              </Pressable>
            );
          })
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

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, ...Typography.body, fontSize: 14, color: Colors.text },

  content:  { paddingBottom: 40 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  avatarText: { ...Typography.headline, fontSize: 18, color: '#fff' },
  info:        { flex: 1, gap: 3 },
  nameRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name:        { ...Typography.body, fontSize: 14.5, color: Colors.text },
  nameBold:    { fontWeight: '700' },
  time:        { ...Typography.caption, fontSize: 11, color: Colors.textMuted },
  preview:     { ...Typography.caption, fontSize: 12.5, color: Colors.textMuted },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { ...Typography.caption, fontSize: 10, color: '#fff', fontWeight: '700' },
  thumb: { width: 44, height: 44, borderRadius: Radius.input, backgroundColor: Colors.stoneSoft, flexShrink: 0 },

  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { ...Typography.headline, color: Colors.text, marginBottom: Spacing[3] },
  emptyBody:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
