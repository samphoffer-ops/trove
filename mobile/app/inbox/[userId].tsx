import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
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
  const { markRead, sendMessage } = useShareStore();
  const { isProductSaved } = useBoardStore();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [otherName, setOtherName] = useState(paramName ?? 'Messages');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function load() {
    if (!user || !userId) return;
    const { data } = await supabase
      .from('shares')
      .select('*, profiles!shares_sender_id_fkey(*)')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    const list = (data ?? []) as Share[];
    setShares(list);

    const theirShare = list.find(s => s.sender_id === userId);
    if (theirShare?.profiles) {
      setOtherName(theirShare.profiles.display_name ?? theirShare.profiles.username ?? paramName ?? 'Messages');
    }

    list.filter(s => s.sender_id === userId && !s.read_at).forEach(s => markRead(s.id));
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }

  useEffect(() => { load(); }, [user, userId]);

  async function handleSend() {
    if (!reply.trim() || !userId || sending) return;
    setSending(true);
    await sendMessage(userId, reply.trim());
    setReply('');
    await load();
    setSending(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <WebFrame maxWidth={480}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {shares.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>Nothing shared yet.</Text>
            </View>
          ) : (
            shares.map(share => {
              const isFromMe = share.sender_id === user?.id;
              const p = share.product_data;
              const saved = p ? isProductSaved(share.product_id!) : false;

              return (
                <View key={share.id} style={[styles.bubble, isFromMe && styles.bubbleMe]}>
                  <Text style={styles.bubbleMeta}>
                    {isFromMe ? 'You' : otherName} · {timeAgo(share.created_at)}
                  </Text>

                  {p ? (
                    <Pressable style={styles.productCard} onPress={() => openProduct(share.product_id!)}>
                      <Image source={{ uri: p.image }} style={styles.productImage} contentFit="cover" />
                      <View style={styles.productInfo}>
                        <Text style={styles.productBrand} numberOfLines={1}>{p.brand}</Text>
                        <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                        <Text style={styles.productPrice}>${p.price}</Text>
                      </View>
                      <Pressable style={styles.bookmarkBtn} onPress={() => setSaveTarget(p)} hitSlop={12}>
                        <BookmarkIcon color={saved ? Colors.accent : Colors.textMuted} filled={saved} size={20} />
                      </Pressable>
                    </Pressable>
                  ) : null}

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

      {/* Reply bar */}
      <View style={[styles.replyBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.replyInput}
          placeholder="Message…"
          placeholderTextColor={Colors.textMuted}
          value={reply}
          onChangeText={setReply}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <Pressable
          style={[styles.sendBtn, (!reply.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!reply.trim() || sending}
        >
          <Text style={styles.sendBtnText}>{sending ? '…' : '↑'}</Text>
        </Pressable>
      </View>
    </View>
    </KeyboardAvoidingView>
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

  content: { padding: 16, gap: 20, paddingBottom: 16 },

  bubble:   { gap: 6 },
  bubbleMe: { alignItems: 'flex-end' },

  bubbleMeta: { ...Typography.caption, fontSize: 11, color: Colors.textMuted, paddingHorizontal: 4 },

  productCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    backgroundColor: Colors.surface, borderRadius: Radius.card,
    padding: Spacing[3], alignSelf: 'stretch',
  },
  productImage: { width: 72, height: 72, borderRadius: Radius.input, backgroundColor: Colors.stoneSoft, flexShrink: 0 },
  productInfo:  { flex: 1, gap: 3 },
  productBrand: { ...Typography.label, color: Colors.accent, letterSpacing: 0.2 },
  productName:  { ...Typography.cardTitle, fontSize: 13.5, color: Colors.text, lineHeight: 18 },
  productPrice: { ...Typography.body, fontSize: 13, color: Colors.text, fontWeight: '600' },
  bookmarkBtn:  { padding: 4, alignSelf: 'flex-start' },

  messageWrap: {
    backgroundColor: Colors.surface, borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: '85%', alignSelf: 'flex-start',
  },
  messageWrapMe: { borderBottomLeftRadius: 16, borderBottomRightRadius: 4, alignSelf: 'flex-end' },
  messageText: { ...Typography.body, fontSize: 14, color: Colors.text, lineHeight: 20 },

  replyBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2],
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 0.5, borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    ...Typography.body, fontSize: 15, color: Colors.text,
    backgroundColor: Colors.surface, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentLime,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: { fontSize: 18, fontWeight: '700', color: Colors.ink },

  empty:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyBody: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
});
