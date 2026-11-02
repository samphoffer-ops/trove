import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActionSheetIOS, Platform } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { usePriceFormatter, useCountry, useCurrencyStore } from '@/store/useCurrencyStore';
import { formatMoney } from '@/lib/currency';
import { useBoardStore } from '@/store/useBoardStore';
import { SaveSheet } from '@/components/SaveSheet';
import { ActionSheet } from '@/components/ActionSheet';
import { ChevronLeftIcon, DotsIcon, CameraIcon, CheckIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing, Animation, DisplayScaling } from '@/lib/theme';
import { Board, BoardItem, Product } from '@/types';
import { WebFrame } from '@/components/WebFrame';
import { MasonryGrid } from '@/components/MasonryGrid';
import { goBack, openProduct } from '@/lib/navigation';
import { pickAndUploadImage } from '@/lib/uploadImage';
import { notify } from '@/lib/alerts';
import * as haptics from '@/lib/haptics';

export default function BoardDetail() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const { user } = useAuthStore();
  const formatPrice = usePriceFormatter();
  const { currency } = useCountry();
  const rates = useCurrencyStore(s => s.rates);
  const { fetchBoardById, getBoardItems, setCoverImage, removeFromBoard, markPurchased, unmarkPurchased } = useBoardStore();
  const [board,      setBoard]      = useState<Board | null>(null);
  const [items,      setItems]      = useState<BoardItem[]>([]);
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
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

  // Summed in the shopper's currency — each item's real price there when the
  // store publishes one, else converted from USD. No rate loaded yet → USD.
  const totalCurrency = currency === 'USD' || rates[currency] ? currency : 'USD';
  const total = items.reduce((n, i) =>
    n + (i.product_data.prices?.[totalCurrency] ?? i.product_data.price * (rates[totalCurrency] ?? 1)), 0);
  const collaborators = board.board_collaborators ?? [];
  // Must match the editor-role boundary the backend actually enforces
  // (board-cover storage policies, board_items insert/delete) — a viewer
  // collaborator seeing these controls would just hit a permission error.
  const canEdit = board.isOwner || collaborators.some(c => c.user_id === user?.id && c.role === 'editor');

  async function changeCoverImage() {
    if (!board) return;
    setUploadingCover(true);
    const { url, error } = await pickAndUploadImage('board-covers', board.id, 'cover');
    if (error) notify('Couldn\'t update cover', error);
    else if (url) await setCoverImage(board.id, url);
    setUploadingCover(false);
    load();
  }

  function openItemMenu(item: BoardItem) {
    haptics.quickActionsOpen();
    const purchasedLabel = item.purchased_at ? 'Unmark as purchased' : 'Mark as purchased';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [purchasedLabel, 'Remove from board', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        async btn => {
          if (btn === 0) {
            if (item.purchased_at) await unmarkPurchased(id!, item.product_id);
            else await markPurchased(id!, item.product_id);
            load();
          }
          if (btn === 1) { await removeFromBoard(id!, item.product_id); setItems(prev => prev.filter(i => i.id !== item.id)); }
        },
      );
    } else {
      setMenuItem(item);
    }
  }

  // Default (wide) frame, like the feed and brand pages: MasonryGrid picks its
  // column count from the window width, so a 480px frame would squeeze it.
  return (
    <WebFrame>
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[3] }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable style={styles.iconBtn} onPress={() => goBack('/(tabs)/boards')} hitSlop={8} accessibilityLabel="Back">
            <ChevronLeftIcon />
          </Pressable>
          {canEdit && (
            <Pressable style={styles.iconBtn} onPress={changeCoverImage} disabled={uploadingCover} hitSlop={8} accessibilityLabel="Change cover">
              <CameraIcon size={18} />
            </Pressable>
          )}
        </View>

        <Text {...DisplayScaling} style={styles.name}>{board.name}</Text>
        <Text style={styles.meta}>{formatMoney(total, totalCurrency)} total</Text>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>Nothing saved here yet. Save from your feed and pick this board.</Text>
          </View>
        ) : (
          // Tight, image-only masonry like the feed (spec §7 Boards): each image
          // at its own ratio, never cropped. The scroll content already has the
          // screen margin, so the grid adds none.
          <MasonryGrid
            items={items}
            keyExtractor={item => item.id}
            itemHeight={item => item.product_data.ratio || 1.25}
            horizontalPadding={0}
            renderItem={item => (
              <BoardTile item={item} canEdit={canEdit} onMenu={() => openItemMenu(item)} />
            )}
          />
        )}
      </ScrollView>

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
      <ActionSheet
        visible={!!menuItem}
        onCancel={() => setMenuItem(null)}
        options={[
          { label: menuItem?.purchased_at ? 'Unmark as purchased' : 'Mark as purchased', onPress: async () => {
            if (menuItem!.purchased_at) await unmarkPurchased(id!, menuItem!.product_id);
            else await markPurchased(id!, menuItem!.product_id);
            load();
          } },
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

// Starts from the stored ratio so the grid lays out before the image arrives,
// then switches to the image's own dimensions, same as the feed's ProductCard.
function BoardTile({ item, canEdit, onMenu }: { item: BoardItem; canEdit: boolean; onMenu: () => void }) {
  const [aspectRatio, setAspectRatio] = useState(1 / (item.product_data.ratio || 1.25));
  return (
    <Pressable
      style={[styles.tile, { aspectRatio }]}
      onPress={() => openProduct(item.product_id)}
      onLongPress={canEdit ? onMenu : undefined}
      accessibilityLabel={`${item.product_data.brand} ${item.product_data.name}`}
    >
      <Image
        source={{ uri: item.product_data.image }}
        style={styles.img}
        contentFit="contain"
        transition={Animation.micro}
        recyclingKey={item.id}
        onLoad={({ source }) => {
          if (source.width && source.height) setAspectRatio(source.width / source.height);
        }}
      />
      {item.purchased_at && (
        <View style={styles.purchasedBadge}>
          <CheckIcon color={Colors.text} size={11} />
        </View>
      )}
      {canEdit && (
        <Pressable style={styles.menuBtn} onPress={onMenu} hitSlop={6} accessibilityLabel="Item options">
          <DotsIcon size={14} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  content:    { paddingHorizontal: Spacing.screen, paddingBottom: 100 },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing[5] },
  iconBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  name:       { ...Typography.display, color: Colors.text },
  meta:       { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing[2], marginBottom: Spacing[5] },
  tile:       { width: '100%', marginBottom: Spacing.gutter, borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.stoneSoft },
  img:        { width: '100%', height: '100%' },
  menuBtn:    { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  purchasedBadge: { position: 'absolute', bottom: 8, left: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accentLime, alignItems: 'center', justifyContent: 'center' },
  empty:      { paddingTop: Spacing[6] },
  emptyBody:  { ...Typography.body, color: Colors.textMuted, maxWidth: 300 },
});
