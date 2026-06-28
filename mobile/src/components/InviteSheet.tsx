import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Modal, Animated, ScrollView, TouchableWithoutFeedback,
} from 'react-native';
import { Board, Profile } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useBoardStore } from '@/store/useBoardStore';
import { fetchFollowing } from '@/lib/social';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { CheckIcon, CloseIcon } from './Icons';

interface Props {
  board:   Board | null;
  onClose: () => void;
}

export function InviteSheet({ board, onClose }: Props) {
  const { user } = useAuthStore();
  const { inviteCollaborator, removeCollaborator } = useBoardStore();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [collaboratorIds, setCollaboratorIds] = useState<Set<string>>(new Set());
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (board && user) {
      setCollaboratorIds(new Set((board.board_collaborators ?? []).map(c => c.user_id)));
      fetchFollowing(user.id).then(setFriends);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    }
  }, [board?.id]);

  function close() {
    Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start(onClose);
  }

  async function toggle(friend: Profile) {
    if (!board) return;
    const isCollaborator = collaboratorIds.has(friend.id);
    setCollaboratorIds(prev => {
      const next = new Set(prev);
      isCollaborator ? next.delete(friend.id) : next.add(friend.id);
      return next;
    });
    if (isCollaborator) await removeCollaborator(board.id, friend.id);
    else await inviteCollaborator(board.id, friend.id);
  }

  if (!board) return null;

  return (
    <Modal transparent visible={!!board} onRequestClose={close} animationType="none">
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheetWrap}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>Invite to "{board.name}"</Text>
            <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
              <CloseIcon color={Colors.textMuted} size={16} />
            </Pressable>
          </View>

          <ScrollView style={styles.list}>
            {friends.length === 0 ? (
              <Text style={styles.empty}>You're not following anyone yet — follow people from their profile to invite them.</Text>
            ) : (
              friends.map(friend => {
                const isCollaborator = collaboratorIds.has(friend.id);
                return (
                  <Pressable key={friend.id} style={styles.row} onPress={() => toggle(friend)}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(friend.display_name ?? friend.username)[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.name}>{friend.display_name ?? friend.username}</Text>
                      <Text style={styles.username}>@{friend.username}</Text>
                    </View>
                    <View style={[styles.check, isCollaborator && styles.checkActive]}>
                      {isCollaborator && <CheckIcon color={Colors.text} />}
                    </View>
                  </Pressable>
                );
              })
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
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
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { ...Typography.headline, color: Colors.text, flexShrink: 1, marginRight: 12 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  list:  { paddingHorizontal: 20 },
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
});
