import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { useBoardStore } from '@/store/useBoardStore';
import { supabase } from '@/lib/supabase';
import { Colors, Radius } from '@/lib/theme';
import { notify, confirmAction } from '@/lib/alerts';
import { pickAndUploadImage } from '@/lib/uploadImage';
import { CameraIcon } from '@/components/Icons';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, deleteAccount, updateProfile } = useAuthStore();
  const { boards } = useBoardStore();
  const [followerCount,  setFollowerCount]  = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function changeAvatar() {
    if (!profile) return;
    setUploadingAvatar(true);
    const url = await pickAndUploadImage('avatars', profile.id, 'avatar');
    if (url) await updateProfile({ avatar_url: url });
    setUploadingAvatar(false);
  }

  useEffect(() => {
    if (!profile) return;
    supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', profile.id)
      .then(({ count }) => setFollowerCount(count ?? 0));
    supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', profile.id)
      .then(({ count }) => setFollowingCount(count ?? 0));
  }, [profile]);

  const totalSaved = boards.reduce((n, b) => n + (b.board_items?.length ?? 0), 0);

  function confirmSignOut() {
    confirmAction('Sign out', 'Are you sure?', 'Sign out', signOut);
  }

  function confirmDeleteAccount() {
    confirmAction(
      'Delete account',
      'This permanently deletes your profile, boards, saved items, and social connections. This can\'t be undone.',
      'Continue',
      confirmDeleteAccountFinal,
    );
  }

  function confirmDeleteAccountFinal() {
    confirmAction(
      'Are you absolutely sure?',
      'There is no way to recover your account after this.',
      'Delete my account',
      async () => {
        setDeleting(true);
        const { error } = await deleteAccount();
        setDeleting(false);
        if (error) notify('Couldn\'t delete account', error);
      },
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Text style={styles.title}>profile</Text>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={styles.hero}>
          <Pressable style={styles.avatar} onPress={changeAvatar} disabled={uploadingAvatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{(profile?.display_name ?? profile?.username ?? '?')[0].toUpperCase()}</Text>
            )}
            <View style={styles.avatarCameraBadge}>
              <CameraIcon color={Colors.text} size={13} />
            </View>
          </Pressable>
          <Text style={styles.displayName}>{profile?.display_name ?? profile?.username}</Text>
          <Text style={styles.username}>@{profile?.username}</Text>
          <Pressable style={styles.editProfileBtn} onPress={() => router.push('/edit-profile')}>
            <Text style={styles.editProfileText}>Edit profile</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { value: boards.length, label: 'Boards' },
            { value: totalSaved,    label: 'Saved' },
            { value: followerCount, label: 'Followers' },
            { value: followingCount,label: 'Following' },
          ].map(s => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <Pressable style={styles.linkRow} onPress={() => router.push('/privacy-policy')}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => router.push('/terms')}>
          <Text style={styles.linkText}>Terms of Service</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.signOutBtn} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={confirmDeleteAccount} disabled={deleting}>
          <Text style={styles.deleteText}>{deleting ? 'Deleting account…' : 'Delete account'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  title:       { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  content:     { paddingHorizontal: 20, paddingBottom: 100 },
  hero:        { alignItems: 'center', paddingVertical: 24 },
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden', position: 'relative' },
  avatarText:  { fontSize: 28, fontWeight: '800', color: '#fff' },
  avatarCameraBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.accentLime, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },
  displayName: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  username:    { fontSize: 14, color: Colors.textMuted },
  editProfileBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  editProfileText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  statsRow:    { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, backgroundColor: Colors.surface, borderRadius: Radius.md },
  stat:        { alignItems: 'center' },
  statValue:   { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  statLabel:   { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: 28 },
  linkRow:     { paddingVertical: 12 },
  linkText:    { fontSize: 15, fontWeight: '500', color: Colors.text },
  deleteBtn:   { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  deleteText:  { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  signOutBtn:  { paddingVertical: 14, alignItems: 'center' },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.destructive },
});
