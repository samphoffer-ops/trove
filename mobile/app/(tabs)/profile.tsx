import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { useBoardStore } from '@/store/useBoardStore';
import { supabase } from '@/lib/supabase';
import { Colors, Radius } from '@/lib/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, deleteAccount } = useAuthStore();
  const { boards } = useBoardStore();
  const [followerCount,  setFollowerCount]  = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', profile.id)
      .then(({ count }) => setFollowerCount(count ?? 0));
    supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', profile.id)
      .then(({ count }) => setFollowingCount(count ?? 0));
  }, [profile]);

  const totalSaved = boards.reduce((n, b) => n + (b.board_items?.length ?? 0), 0);

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, boards, saved items, and social connections. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: confirmDeleteAccountFinal },
      ],
    );
  }

  function confirmDeleteAccountFinal() {
    Alert.alert(
      'Are you absolutely sure?',
      'There is no way to recover your account after this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await deleteAccount();
            setDeleting(false);
            if (error) Alert.alert('Couldn\'t delete account', error);
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Profile</Text>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.display_name ?? profile?.username ?? '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.displayName}>{profile?.display_name ?? profile?.username}</Text>
          <Text style={styles.username}>@{profile?.username}</Text>
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
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:  { fontSize: 28, fontWeight: '800', color: '#fff' },
  displayName: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  username:    { fontSize: 14, color: Colors.textMuted },
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
