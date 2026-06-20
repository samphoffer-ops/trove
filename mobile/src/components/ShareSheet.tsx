import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Modal, Animated, ScrollView, TouchableWithoutFeedback,
} from 'react-native';
import { Product, Profile } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useShareStore } from '@/store/useShareStore';
import { fetchFollowing } from '@/lib/social';
import { Colors, Radius } from '@/lib/theme';
import { CheckIcon } from './Icons';

interface Props {
  product: Product | null;
  onClose: () => void;
}

export function ShareSheet({ product, onClose }: Props) {
  const { user } = useAuthStore();
  const { sendShare } = useShareStore();
  const [friends,  setFriends]  = useState<Profile[]>([]);
  const [picked,   setPicked]   = useState<string[]>([]);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (product && user) {
      setPicked([]);
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
    await sendShare(picked, product);
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
          <Text style={styles.title}>Share with a friend</Text>

          <ScrollView style={styles.list}>
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
            <View style={{ height: 24 }} />
          </ScrollView>

          {friends.length > 0 && (
            <View style={styles.footer}>
              <Pressable
                style={[styles.sendBtn, (picked.length === 0 || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={picked.length === 0 || sending}
              >
                <Text style={styles.sendBtnText}>
                  {sent ? 'Sent' : sending ? 'Sending…' : picked.length > 1 ? `Send to ${picked.length}` : 'Send'}
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
    maxHeight:       '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  title: {
    fontSize: 17, fontWeight: '700', color: Colors.text,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  list:  { paddingHorizontal: 20 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 21, paddingVertical: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  info:       { flex: 1 },
  name:       { fontSize: 15, fontWeight: '600', color: Colors.text },
  username:   { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { backgroundColor: Colors.accentLime, borderColor: Colors.accentLime },
  footer:    { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  sendBtn:   { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingVertical: 15, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText:     { color: Colors.text, fontSize: 15, fontWeight: '700' },
});
