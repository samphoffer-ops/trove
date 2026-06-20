import { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShareStore } from '@/store/useShareStore';
import { ChevronLeftIcon } from '@/components/Icons';
import { Colors, Radius } from '@/lib/theme';
import { Share } from '@/types';
import { WebFrame } from '@/components/WebFrame';

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

  useEffect(() => { fetchInbox(); }, []);

  function openShare(share: Share) {
    markRead(share.id);
    router.push(`/product/${share.product_id}`);
  }

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>Shared with you</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {inbox.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>When a friend shares a product with you, it'll show up here.</Text>
          </View>
        ) : (
          inbox.map(share => {
            const sender = share.profiles;
            return (
              <Pressable key={share.id} style={styles.row} onPress={() => openShare(share)}>
                {!share.read_at && <View style={styles.unreadDot} />}
                <Image source={{ uri: share.product_data.image }} style={styles.thumb} contentFit="cover" />
                <View style={styles.info}>
                  <Text style={styles.sender} numberOfLines={1}>
                    <Text style={styles.senderName}>{sender?.display_name ?? sender?.username ?? 'Someone'}</Text> shared a find
                  </Text>
                  <Text style={styles.productName} numberOfLines={1}>{share.product_data.brand} · {share.product_data.name}</Text>
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
  topBarTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  content:     { paddingHorizontal: 16, paddingBottom: 100 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  unreadDot:   { position: 'absolute', left: -2, top: '50%', width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent },
  thumb:       { width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Colors.stoneSoft },
  info:        { flex: 1 },
  sender:      { fontSize: 14, color: Colors.text },
  senderName:  { fontWeight: '700' },
  productName: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  time:        { fontSize: 11.5, color: Colors.textMuted, marginTop: 4 },
  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptyBody:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 21 },
});
