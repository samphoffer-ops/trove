import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { useBoardStore } from '@/store/useBoardStore';
import { supabase } from '@/lib/supabase';
import { fetchFollowedBrands } from '@/lib/social';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { notify } from '@/lib/alerts';
import { openProduct } from '@/lib/navigation';
import { pickAndUploadImage } from '@/lib/uploadImage';
import { CameraIcon, GearIcon } from '@/components/Icons';
import { BoardCard } from './boards';
import { Brand, BoardItem } from '@/types';

const BOARDS_PREVIEW_COUNT = 4;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useAuthStore();
  const { boards } = useBoardStore();
  const [followerCount,  setFollowerCount]  = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followedBrands, setFollowedBrands] = useState<Brand[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function changeAvatar() {
    if (!profile) return;
    setUploadingAvatar(true);
    const { url, error } = await pickAndUploadImage('avatars', profile.id, 'avatar');
    if (error) notify('Couldn\'t update photo', error);
    else if (url) {
      const { error: saveError } = await updateProfile({ avatar_url: url });
      if (saveError) notify('Couldn\'t save photo', saveError);
    }
    setUploadingAvatar(false);
  }

  useEffect(() => {
    if (!profile) return;
    supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', profile.id)
      .then(({ count }) => setFollowerCount(count ?? 0));
    supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', profile.id)
      .then(({ count }) => setFollowingCount(count ?? 0));
    fetchFollowedBrands(profile.id).then(setFollowedBrands);
  }, [profile]);

  const ownedBoards = boards.filter(b => b.isOwner);
  const totalSaved = boards.reduce((n, b) => n + (b.board_items?.length ?? 0), 0);

  // Recently purchased — derived from boards already in the store, no
  // separate fetch needed. Owned boards only: marking something purchased
  // is a statement about your own buying behavior, not a collaborator's.
  const recentlyPurchased = ownedBoards
    .flatMap(b => (b.board_items ?? []).filter((i): i is BoardItem & { purchased_at: string } => !!i.purchased_at))
    .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
    .slice(0, 10);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>profile</Text>
        <Pressable style={styles.gearBtn} onPress={() => router.push('/settings')} hitSlop={8}>
          <GearIcon color={Colors.text} size={22} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + name + bio */}
        <View style={styles.hero}>
          <Pressable style={styles.avatarWrap} onPress={changeAvatar} disabled={uploadingAvatar}>
            <View style={styles.avatar}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>{(profile?.display_name ?? profile?.username ?? '?')[0].toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.avatarCameraBadge}>
              <CameraIcon color={Colors.text} size={13} />
            </View>
          </Pressable>
          <Text style={styles.displayName}>{profile?.display_name ?? profile?.username}</Text>
          <Text style={styles.username}>@{profile?.username}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
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

        {followedBrands.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brands you follow</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRow}>
              {followedBrands.map(brand => (
                <Pressable key={brand.id} style={styles.brandChip} onPress={() => router.push(`/brand/${brand.id}`)}>
                  <Text style={styles.brandChipText}>{brand.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {recentlyPurchased.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recently purchased</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.purchasedRow}>
              {recentlyPurchased.map(item => (
                <Pressable key={item.product_id} style={styles.purchasedCard} onPress={() => openProduct(item.product_id)}>
                  <Image source={{ uri: item.product_data?.image }} style={styles.purchasedImg} contentFit="cover" />
                  <Text style={styles.purchasedName} numberOfLines={1}>{item.product_data?.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {ownedBoards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Your boards</Text>
              {ownedBoards.length > BOARDS_PREVIEW_COUNT && (
                <Pressable onPress={() => router.push('/(tabs)/boards')}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.boardsGrid}>
              {ownedBoards.slice(0, BOARDS_PREVIEW_COUNT).map(board => <BoardCard key={board.id} board={board} />)}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  titleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Spacing[3] },
  title:       { ...Typography.display, color: Colors.text },
  gearBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  content:     { paddingHorizontal: 20, paddingBottom: 100 },
  hero:        { alignItems: 'center', paddingVertical: Spacing[6] },
  avatarWrap:  { width: 72, height: 72, marginBottom: Spacing[3], position: 'relative' },
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText:  { ...Typography.display, color: '#fff' },
  avatarCameraBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.accentLime, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },
  displayName: { ...Typography.headline, fontSize: 20, color: Colors.text, marginBottom: Spacing[1] },
  username:    { ...Typography.body, color: Colors.textMuted },
  bio:         { ...Typography.body, color: Colors.text, textAlign: 'center', marginTop: Spacing[3], paddingHorizontal: 12, lineHeight: 20 },
  editProfileBtn: { marginTop: Spacing[3], paddingHorizontal: 16, paddingVertical: Spacing[3], borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  editProfileText: { ...Typography.cardTitle, color: Colors.text },
  statsRow:    { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing[5], backgroundColor: Colors.surface, borderRadius: Radius.card },
  stat:        { alignItems: 'center' },
  statValue:   { ...Typography.display, fontSize: 24, color: Colors.text },
  statLabel:   { ...Typography.label, color: Colors.textMuted, marginTop: Spacing[1] },
  section:        { marginTop: Spacing[6] },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle:   { ...Typography.headline, fontSize: 16, color: Colors.text, marginBottom: Spacing[3] },
  seeAll:         { ...Typography.caption, color: Colors.accent },
  brandRow:       { gap: Spacing[3] },
  brandChip:      { paddingHorizontal: 16, paddingVertical: Spacing[3], borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  brandChipText:  { ...Typography.cardTitle, color: Colors.text },
  purchasedRow:   { gap: Spacing[3] },
  purchasedCard:  { width: 110 },
  purchasedImg:   { width: 110, height: 138, borderRadius: Radius.card, backgroundColor: Colors.stoneSoft, marginBottom: Spacing[1] },
  purchasedName:  { ...Typography.caption, color: Colors.text },
  boardsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[4] },
});
