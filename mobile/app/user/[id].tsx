import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { ChevronLeftIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { Profile, Board } from '@/types';
import { WebFrame } from '@/components/WebFrame';
import { goBack } from '@/lib/navigation';

export default function UserProfile() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [boards,       setBoards]       = useState<Board[]>([]);
  const [isFollowing,  setIsFollowing]  = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    supabase.from('profiles').select('*').eq('id', id).single()
      .then(({ data }) => data && setProfile(data as Profile));
    supabase.from('boards').select('*, board_items(product_id, product_data)').eq('user_id', id).eq('is_public', true)
      .then(({ data }) => setBoards((data ?? []) as Board[]));
    supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', id)
      .then(({ count }) => setFollowerCount(count ?? 0));
    if (user) {
      supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id).maybeSingle()
        .then(({ data }) => setIsFollowing(!!data));
    }
  }, [id, user]);

  async function toggleFollow() {
    if (!user || !id) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id);
      setIsFollowing(false);
      setFollowerCount(n => n - 1);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
      setIsFollowing(true);
      setFollowerCount(n => n + 1);
    }
  }

  if (!profile) return null;
  const isOwnProfile = user?.id === id;

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/(tabs)/feed')} hitSlop={8}><ChevronLeftIcon /></Pressable>
        <Text style={styles.topBarTitle}>@{profile.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{(profile.display_name ?? profile.username)[0].toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.displayName}>{profile.display_name ?? profile.username}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          <Text style={styles.followerText}>{followerCount} follower{followerCount !== 1 ? 's' : ''}</Text>
        </View>

        {!isOwnProfile && (
          <Pressable style={[styles.followBtn, isFollowing && styles.followBtnActive]} onPress={toggleFollow}>
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Boards</Text>
        <View style={styles.boardGrid}>
          {boards.map(board => {
            const items = board.board_items ?? [];
            const coverItem = items.find(i => i.product_id === board.cover_product_id) ?? items[0];
            const coverImage = board.cover_image_url ?? coverItem?.product_data?.image;
            return (
              <Pressable key={board.id} style={styles.boardCard} onPress={() => router.push(`/board/${board.id}`)}>
                <View style={styles.boardCover}>
                  {coverImage && (
                    <Image source={{ uri: coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  )}
                </View>
                <View style={styles.boardInfo}>
                  <Text style={styles.boardName}>{board.name}</Text>
                  <Text style={styles.boardCount}>{items.length} items</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  topBarTitle:{ ...Typography.cardTitle, fontSize: 16, color: Colors.text },
  content:    { paddingHorizontal: 20, paddingBottom: 100 },
  hero:       { alignItems: 'center', paddingVertical: Spacing[6] },
  avatar:     { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[3], overflow: 'hidden' },
  avatarText: { ...Typography.display, color: '#fff' },
  displayName:{ ...Typography.headline, fontSize: 20, color: Colors.text, marginBottom: Spacing[1] },
  username:   { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing[1] },
  followerText:{ ...Typography.caption, fontSize: 13, color: Colors.textMuted },
  followBtn:  { borderWidth: 1.5, borderColor: Colors.text, borderRadius: Radius.full, paddingVertical: 12, alignItems: 'center', marginBottom: Spacing[6] },
  followBtnActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  followBtnText:   { ...Typography.headline, fontSize: 15, color: Colors.text },
  followBtnTextActive: { color: Colors.accentLime },
  sectionTitle:{ ...Typography.headline, color: Colors.text, marginBottom: Spacing[4] },
  boardGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[5] },
  boardCard:  { width: '47%', borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.surface },
  boardCover: { width: '100%', aspectRatio: 1, backgroundColor: Colors.stoneSoft },
  boardInfo:  { padding: Spacing[3] },
  boardName:  { ...Typography.cardTitle, color: Colors.text, marginBottom: Spacing[1] },
  boardCount: { ...Typography.caption, color: Colors.textMuted },
});
