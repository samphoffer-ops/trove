import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput,
  Modal, Animated, ScrollView, TouchableWithoutFeedback,
} from 'react-native';
import { Product, Profile } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useShareStore } from '@/store/useShareStore';
import { fetchFollowing } from '@/lib/social';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { CheckIcon, CloseIcon } from './Icons';

interface Props {
  product: Product | null;
  onClose: () => void;
}

export function ShareSheet({ product, onClose }: Props) {
  const { user } = useAuthStore();
  const { sendShare } = useShareStore();
  const [friends,  setFriends]  = useState<Profile[]>([]);
  const [picked,   setPicked]   = useState<string[]>([]);
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (product && user) {
      setPicked([]);
      setMessage('');
      setSent(false);
      fetchFollowing(user.id).then(setFriends);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    }
  }, [product]);

  function close() {
    Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start(onClose);
  }

  function toggle(id: string) {
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSend() {
    if (!product || picked.length === 0) return;
    setSending(true);
    await sendShare(picked, product, message);
    setSending(false);
    setSent(true);
    setTimeout(close, 700);
  }

  if (!product) return null;

  return (
    <Modal transparent visible={!!product} onRequestClose={close} animationType="none">
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheetWrap}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Share with a friend</Text>
            <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
              <CloseIcon color={Colors.textMuted} size={16} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {friends.length === 0 ? (
              <Text style={styles.empty}>You're not following anyone yet — follow people from their profile to share with them.</Text>
            ) : (
              friends.map(friend => {
                const isPicked = picked.includes(friend.id);
                return (
                  <Pressable key={friend.id} style={styles.row} onPress={() => toggle(friend.id)}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(friend.display_name ?? friend.username)[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.name}>{friend.display_name ?? friend.username}</Text>
                      <Text style={styles.username}>@{friend.username}</Text>
                    </View>
                    <View style={[styles.check, isPicked && styles.checkActive]}>
                      {isPicked && <CheckIcon color={Colors.text} />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {friends.length > 0 && (
            <View style={styles.footer}>
              <TextInput
                style={styles.messageInput}
                placeholder="Add a note… (optional)"
                placeholderTextColor={Colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={280}
                returnKeyType="done"
                blurOnSubmit
              />
              <Pressable
                style={[styles.sendBtn, (picked.length === 0 || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={picked.length === 0 || sending}
              >
                <Text style={styles.sendBtnText}>
                  {sent ? 'Sent ✓' : sending ? 'Sending…' : picked.length > 1 ? `Send to ${picked.length}` : 'Send'}
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:       '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { ...Typography.headline, color: Colors.text },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  list:  { paddingHorizontal: 20, maxHeight: 260 },
  empty: { ...Typography.body, fontSize: 14, color: Colors.textMuted, paddingVertical: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[4], paddingVertical: Spacing[3],
  },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...Typography.headline, color: '#fff' },
  info:       { flex: 1 },
  name:       { ...Typography.cardTitle, fontSize: 15, color: Colors.text },
  username:   { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { backgroundColor: Colors.accentLime, borderColor: Colors.accentLime },
  footer: {
    padding: 16, gap: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  messageInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.input,
    paddingHorizontal: 14, paddingVertical: 11,
    ...Typography.body, fontSize: 14, color: Colors.text,
    backgroundColor: Colors.bg, minHeight: 44, maxHeight: 88,
  },
  sendBtn:   { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingVertical: 15, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText:     { ...Typography.headline, fontSize: 15, color: Colors.text },
});
