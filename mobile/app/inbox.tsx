import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShareStore } from '@/store/useShareStore';
import { ChevronLeftIcon, SearchIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { Share } from '@/types';
import { WebFrame } from '@/components/WebFrame';
import { goBack, openProduct } from '@/lib/navigation';

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Inbox() {
  const insets = useSafeAreaInsets();
  const { inbox, fetchInbox, markRead } = useShareStore();
  const [query, setQuery] = useState('');

  useEffect(() => { fetchInbox(); }, []);

  function openShare(share: Share) {
    markRead(share.id);
    openProduct(share.product_id);
  }

  const filtered = query.trim()
    ? inbox.filter(s => {
        const q = query.toLowerCase();
        const name = (s.profiles?.display_name ?? s.profiles?.username ?? '').toLowerCase();
        const product = `${s.product_data.brand} ${s.product_data.name}`.toLowerCase();
        return name.includes(q) || product.includes(q);
      })
    : inbox;

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
          placeholder="Search messages…"
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
              <Text style={styles.emptyBody}>No results for "{query}"</Text>
            )}
          </View>
        ) : (
          filtered.map(share => {
            const sender = share.profiles;
            const senderName = sender?.display_name ?? sender?.username ?? 'Someone';
            return (
              <Pressable key={share.id} style={styles.row} onPress={() => openShare(share)}>
                {!share.read_at && <View style={styles.unreadDot} />}
                <Image source={{ uri: share.product_data.image }} style={styles.thumb} contentFit="cover" />
                <View style={styles.info}>
                  <Text style={styles.sender} numberOfLines={1}>
                    <Text style={styles.senderName}>{senderName}</Text>
                    {' shared a find'}
                  </Text>
                  <Text style={styles.productName} numberOfLines={1}>
                    {share.product_data.brand} · {share.product_data.name}
                  </Text>
                  {share.message ? (
                    <Text style={styles.message} numberOfLines={2}>"{share.message}"</Text>
                  ) : null}
                  <Text style={styles.time}>{timeAgo(share.created_at)}</Text>
                </View>
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
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, ...Typography.body, fontSize: 14, color: Colors.text },

  content:     { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[4],
    paddingVertical: Spacing[4], paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  unreadDot:   { position: 'absolute', left: -2, top: 24, width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent },
  thumb:       { width: 56, height: 56, borderRadius: Radius.input, backgroundColor: Colors.stoneSoft, flexShrink: 0 },
  info:        { flex: 1, gap: 3 },
  sender:      { ...Typography.body, fontSize: 14, color: Colors.text },
  senderName:  { fontWeight: '700' },
  productName: { ...Typography.cardTitle, color: Colors.textMuted },
  message:     { ...Typography.body, fontSize: 13, color: Colors.text, fontStyle: 'italic', opacity: 0.8 },
  time:        { ...Typography.caption, fontSize: 11.5, color: Colors.textMuted },
  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { ...Typography.headline, color: Colors.text, marginBottom: Spacing[3] },
  emptyBody:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
