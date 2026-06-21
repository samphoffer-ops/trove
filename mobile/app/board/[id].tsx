import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActionSheetIOS, Platform } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { useBoardStore } from '@/store/useBoardStore';
import { SaveSheet } from '@/components/SaveSheet';
import { InviteSheet } from '@/components/InviteSheet';
import { ActionSheet } from '@/components/ActionSheet';
import { ChevronLeftIcon, DotsIcon, UserPlusIcon, CameraIcon } from '@/components/Icons';
import { Colors, Radius } from '@/lib/theme';
import { Board, BoardItem, Product } from '@/types';
import { WebFrame } from '@/components/WebFrame';
import { goBack } from '@/lib/navigation';
import { pickAndUploadImage } from '@/lib/uploadImage';

export default function BoardDetail() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fetchBoardById, getBoardItems, setCover, setCoverImage, removeFromBoard } = useBoardStore();
  const [board,      setBoard]      = useState<Board | null>(null);
  const [items,      setItems]      = useState<BoardItem[]>([]);
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [inviting,   setInviting]   = useState(false);
  const [menuItem,   setMenuItem]   = useState<BoardItem | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchBoardById(id).then(setBoard);
    getBoardItems(id).then(setItems);
  }, [id]);

  useEffect(load, [load]);
  useFocusEffect(load);

  if (!board) return null;

  const total = items.reduce((n, i) => n + i.product_data.price, 0);
  const collaborators = board.board_collaborators ?? [];
  const canEdit = board.isOwner || collaborators.some(c => c.user_id === user?.id);

  async function changeCoverImage() {
    if (!board) return;
    setUploadingCover(true);
    const url = await pickAndUploadImage('board-covers', board.id, 'cover');
    if (url) await setCoverImage(board.id, url);
    setUploadingCover(false);
    load();
  }

  function openItemMenu(item: BoardItem) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Set as cover', 'Remove from board', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        async btn => {
          if (btn === 0) { await setCover(id!, item.product_id); load(); }
          if (btn === 1) { await removeFromBoard(id!, item.product_id); setItems(prev => prev.filter(i => i.id !== item.id)); }
        },
      );
    } else {
      setMenuItem(item);
    }
  }

  const leftCol  = items.filter((_, i) => i % 2 === 0);
  const rightCol = items.filter((_, i) => i % 2 === 1);
  const coverItem = items.find(i => i.product_id === board.cover_product_id) ?? items[0];
  const coverImage = board.cover_image_url ?? coverItem?.product_data.image;

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root]}>
      {/* Cover */}
      <View style={[styles.cover, { paddingTop: insets.top }]}>
        {coverImage && <Image source={{ uri: coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        <View style={styles.coverScrim} />
        <View style={styles.coverTopRow}>
          <Pressable style={styles.coverIconBtn} onPress={() => goBack('/(tabs)/boards')} hitSlop={8}>
            <ChevronLeftIcon />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {canEdit && (
              <Pressable style={styles.coverIconBtn} onPress={changeCoverImage} disabled={uploadingCover} hitSlop={8}>
                <CameraIcon size={18} />
              </Pressable>
            )}
            {board.isOwner && (
              <Pressable style={styles.coverIconBtn} onPress={() => setInviting(true)} hitSlop={8}>
                <UserPlusIcon size={19} />
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.coverBottom}>
          <Text style={styles.name}>{board.name}</Text>
          <Text style={styles.meta}>
            {items.length} item{items.length !== 1 ? 's' : ''} · ${total.toLocaleString()} total
            {collaborators.length > 0 ? ` · Shared with ${collaborators.length}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing saved here yet</Text>
            <Text style={styles.emptyBody}>Save items from your feed and choose this board.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {[leftCol, rightCol].map((col, ci) => (
              <View key={ci} style={styles.col}>
                {col.map(item => (
                  <Pressable key={item.id} style={styles.card} onPress={() => router.push(`/product/${item.product_id}`)}>
                    <Image source={{ uri: item.product_data.image }} style={styles.img} contentFit="cover" />
                    {canEdit && (
                      <Pressable style={styles.menuBtn} onPress={() => openItemMenu(item)} hitSlop={6}>
                        <DotsIcon size={16} />
                      </Pressable>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardBrand}>{item.product_data.brand}</Text>
                      <Text style={styles.cardName} numberOfLines={2}>{item.product_data.name}</Text>
                      <Text style={styles.cardPrice}>${item.product_data.price}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
      <InviteSheet board={inviting ? board : null} onClose={() => { setInviting(false); load(); }} />
      <ActionSheet
        visible={!!menuItem}
        onCancel={() => setMenuItem(null)}
        options={[
          { label: 'Set as cover', onPress: async () => { await setCover(id!, menuItem!.product_id); load(); } },
          { label: 'Remove from board', destructive: true, onPress: async () => {
            await removeFromBoard(id!, menuItem!.product_id);
            setItems(prev => prev.filter(i => i.id !== menuItem!.id));
          } },
        ]}
      />
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  cover:      { width: '100%', aspectRatio: 16/9, backgroundColor: Colors.stoneSoft, justifyContent: 'space-between' },
  coverScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,12,29,0.28)' },
  coverTopRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  coverIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' },
  coverBottom: { paddingHorizontal: 20, paddingBottom: 16 },
  name:       { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  meta:       { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  content:    { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 100 },
  grid:       { flexDirection: 'row', gap: 12 },
  col:        { flex: 1 },
  card:       { borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.surface, marginBottom: 12, position: 'relative' },
  img:        { width: '100%', aspectRatio: 4/5, backgroundColor: Colors.stoneSoft },
  menuBtn:    { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  cardInfo:   { padding: 10 },
  cardBrand:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, color: Colors.textMuted, marginBottom: 2 },
  cardName:   { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 4, lineHeight: 17 },
  cardPrice:  { fontSize: 13, fontWeight: '600', color: Colors.accentBlue },
  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptyBody:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 21 },
});
