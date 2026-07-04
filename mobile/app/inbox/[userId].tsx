import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { useShareStore } from '@/store/useShareStore';
import { useBoardStore } from '@/store/useBoardStore';
import { supabase } from '@/lib/supabase';
import { ChevronLeftIcon, BookmarkIcon } from '@/components/Icons';
import { SaveSheet } from '@/components/SaveSheet';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { Share, Product } from '@/types';
import { WebFrame } from '@/components/WebFrame';
import { goBack, openProduct } from '@/lib/navigation';

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Conversation() {
  const { userId, name: paramName } = useLocalSearchParams<{ userId: string; name: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { markRead } = useShareStore();
  const { isProductSaved } = useBoardStore();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [otherName, setOtherName] = useState(paramName ?? 'Messages');

  useEffect(() => {
    if (!user || !userId) return;

    supabase
      .from('shares')
      .select('*, profiles!shares_sender_id_fkey(*)')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as Share[];
        setShares(list);

        // Resolve the other person's display name from their share profile
        const theirShare = list.find(s => s.sender_id === userId);
        if (theirShare?.profiles) {
          setOtherName(theirShare.profiles.display_name ?? theirShare.profiles.username ?? paramName ?? 'Messages');
        }

        // Mark all their unread shares as read
        list.filter(s => s.sender_id === userId && !s.read_at).forEach(s => markRead(s.id));
        setLoading(false);
      });
  }, [user, userId]);

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/inbox')} hitSlop={8}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>{otherName}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {shares.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>No shared products yet.</Text>
            </View>
          ) : (
            shares.map(share => {
              const isFromMe = share.sender_id === user?.id;
              const saved = isProductSaved(share.product_id);
              const p = share.product_data;

              return (
                <View key={share.id} style={[styles.bubble, isFromMe && styles.bubbleMe]}>
                  <Text style={styles.bubbleMeta}>
                    {isFromMe ? 'You' : otherName} · {timeAgo(share.created_at)}
                  </Text>

                  <Pressable style={styles.productCard} onPress={() => openProduct(share.product_id)}>
                    <Image source={{ uri: p.image }} style={styles.productImage} contentFit="cover" />
                    <View style={styles.productInfo}>
                      <Text style={styles.productBrand} numberOfLines={1}>{p.brand}</Text>
                      <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                      <Text style={styles.productPrice}>${p.price}</Text>
                    </View>
                    <Pressable
                      style={styles.bookmarkBtn}
                      onPress={() => setSaveTarget(p)}
                      hitSlop={12}
                    >
                      <BookmarkIcon
                        color={saved ? Colors.accent : Colors.textMuted}
                        filled={saved}
                        size={20}
                      />
                    </Pressable>
                  </Pressable>

                  {share.message ? (
                    <View style={[styles.messageWrap, isFromMe && styles.messageWrapMe]}>
                      <Text style={styles.messageText}>{share.message}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  topBarTitle: { ...Typography.cardTitle, fontSize: 16, color: Colors.text, flex: 1, textAlign: 'center' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: { padding: 16, gap: 20, paddingBottom: 80 },

  bubble: { gap: 8 },
  bubbleMe: { alignItems: 'flex-end' },

  bubbleMeta: { ...Typography.caption, fontSize: 11, color: Colors.textMuted, paddingHorizontal: 4 },

  productCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing[3], alignSelf: 'stretch',
  },
  productImage: {
    width: 72, height: 72, borderRadius: Radius.input,
    backgroundColor: Colors.stoneSoft, flexShrink: 0,
  },
  productInfo:  { flex: 1, gap: 3 },
  productBrand: { ...Typography.label, color: Colors.accent, letterSpacing: 0.2 },
  productName:  { ...Typography.cardTitle, fontSize: 13.5, color: Colors.text, lineHeight: 18 },
  productPrice: { ...Typography.body, fontSize: 13, color: Colors.text, fontWeight: '600' },

  bookmarkBtn: { padding: 4, alignSelf: 'flex-start' },

  messageWrap: {
    backgroundColor: Colors.surface, borderRadius: 14, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: '85%', alignSelf: 'flex-start',
  },
  messageWrapMe: {
    borderBottomLeftRadius: 14, borderBottomRightRadius: 4, alignSelf: 'flex-end',
  },
  messageText: { ...Typography.body, fontSize: 14, color: Colors.text, lineHeight: 20 },

  empty:      { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyBody:  { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
