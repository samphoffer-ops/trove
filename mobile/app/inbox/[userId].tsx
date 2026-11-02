import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Animated,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { useShareStore } from '@/store/useShareStore';
import { useBoardStore } from '@/store/useBoardStore';
import { supabase } from '@/lib/supabase';
import { ChevronLeftIcon } from '@/components/Icons';
import { ProductCard } from '@/components/ProductCard';
import { Colors, Radius, Typography, Spacing, DisplayScaling } from '@/lib/theme';
import { Share, Product } from '@/types';
import { WebFrame } from '@/components/WebFrame';
import { goBack, openSaveSheet } from '@/lib/navigation';

const MAX_WIDTH = 480;

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
  const [otherName, setOtherName] = useState(paramName ?? 'Messages');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  // Shared products render at the feed's card width (spec §7 Feed).
  const cardWidth = (Math.min(width, MAX_WIDTH) - Spacing.screen * 2 - Spacing.gutter) / 2;

  // iOS large-title pattern: the oversized name heads the thread, and the
  // small name in the top bar fades in once it has scrolled away.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [titleBottom, setTitleBottom] = useState(80);
  const barTitleOpacity = scrollY.interpolate({
    inputRange: [titleBottom - 24, titleBottom],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

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
    <WebFrame maxWidth={MAX_WIDTH}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/inbox')} hitSlop={11} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeftIcon />
        </Pressable>
        <Animated.Text style={[styles.topBarTitle, { opacity: barTitleOpacity }]} numberOfLines={1} importantForAccessibility="no">
          {otherName}
        </Animated.Text>
        <View style={styles.topBarSpacer} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        >
          {/* The thread's editorial moment (spec §1): the other person's name, oversized and left-aligned */}
          <Text
            {...DisplayScaling}
            style={styles.name}
            numberOfLines={2}
            accessibilityRole="header"
            onLayout={e => setTitleBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
          >
            {otherName}
          </Text>

          {shares.length === 0 ? (
            <Text style={styles.emptyBody}>Nothing shared yet.</Text>
          ) : (
            shares.map(share => {
              const isFromMe = share.sender_id === user?.id;
              const p = share.product_data;

              return (
                <View key={share.id} style={[styles.bubble, isFromMe && styles.bubbleMe]}>
                  <Text style={styles.bubbleMeta}>
                    {isFromMe ? 'You' : otherName} · {timeAgo(share.created_at)}
                  </Text>

                  {p ? (
                    <View style={{ width: cardWidth }}>
                      <ProductCard
                        product={{ ...p, id: share.product_id ?? p.id }}
                        saved={isProductSaved(share.product_id!)}
                        onSave={openSaveSheet}
                      />
                    </View>
                  ) : null}

                  {share.message ? (
                    <View style={[styles.message, isFromMe ? styles.messageMe : styles.messageThem]}>
                      <Text style={styles.messageText}>{share.message}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </Animated.ScrollView>
      )}

      {/* Reply bar: the send button is the screen's one primary action */}
      <View style={[styles.replyBar, { paddingBottom: insets.bottom + Spacing[3] }]}>
        <TextInput
          style={styles.replyInput}
          placeholder="Message"
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
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          {sending
            ? <ActivityIndicator size="small" color={Colors.ink} />
            : <Text style={styles.sendBtnText}>↑</Text>}
        </Pressable>
      </View>
    </View>
    </KeyboardAvoidingView>
    </WebFrame>
  );
}

const CONTROL = 40;

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[4],
    height: 44, paddingHorizontal: Spacing.screen,
  },
  topBarTitle:  { ...Typography.cardTitle, color: Colors.text, flex: 1, textAlign: 'center' },
  topBarSpacer: { width: 22 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: Spacing.screen, paddingBottom: Spacing[5], gap: Spacing[5] },
  name:    { ...Typography.display, color: Colors.text, paddingTop: Spacing[4], marginBottom: Spacing[3] },

  bubble:     { gap: Spacing[2], alignItems: 'flex-start' },
  bubbleMe:   { alignItems: 'flex-end' },
  bubbleMeta: { ...Typography.caption, color: Colors.textMuted },

  message: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    maxWidth: '85%',
  },
  messageThem: { borderBottomLeftRadius: Radius.badge },
  messageMe:   { borderBottomRightRadius: Radius.badge },
  messageText: { ...Typography.body, color: Colors.text },

  replyBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[3],
    paddingHorizontal: Spacing.screen, paddingTop: Spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  replyInput: {
    flex: 1, minHeight: CONTROL, maxHeight: 120,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing[4], paddingTop: Spacing[3], paddingBottom: Spacing[3],
    ...Typography.body, color: Colors.text,
    backgroundColor: Colors.surface,
  },
  sendBtn: {
    width: CONTROL, height: CONTROL, borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: { ...Typography.headline, color: Colors.ink },

  emptyBody: { ...Typography.body, color: Colors.textMuted, maxWidth: 300 },
});
