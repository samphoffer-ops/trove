import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, ActivityIndicator, Platform, Modal, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_STEPS, EDITORIAL_STRIPS } from '@/data/products';
import { useProductsStore, getProducts } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useShareStore } from '@/store/useShareStore';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchFollowedBrands } from '@/lib/social';
import { ProductCard } from '@/components/ProductCard';
import { MasonryGrid } from '@/components/MasonryGrid';
import { SaveSheet } from '@/components/SaveSheet';
import { ShareSheet } from '@/components/ShareSheet';
import { QuickActionsMenu, QuickAction } from '@/components/QuickActionsMenu';
import { Logo } from '@/components/Logo';
import { InboxIcon, ChevronLeftIcon, BookmarkIcon, ShareIcon, CloseIcon, FilterIcon, CheckIcon } from '@/components/Icons';
import { Product } from '@/types';
import { Colors, Radius, Typography, Spacing, Shadows } from '@/lib/theme';
import { openProduct } from '@/lib/navigation';

const CHIPS = [
  { id: 'explore',  label: 'explore'  },
  { id: 'new',      label: 'new'      },
  { id: 'trending', label: 'trending' },
] as const;

type ChipId = typeof CHIPS[number]['id'];

// 'womens'/'mens' filter on brand audience (see brandAudience in
// useProductsStore); everything else filters on the product's own
// category. 'all' is the default, no filtering applied.
const CATEGORY_CHIPS = [
  { id: 'all',         label: 'all'         },
  { id: 'womens',      label: "women's"     },
  { id: 'mens',        label: "men's"       },
  { id: 'clothing',    label: 'clothing'    },
  { id: 'shoes',       label: 'shoes'       },
  { id: 'bags',        label: 'bags'        },
  { id: 'accessories', label: 'accessories' },
  { id: 'home',        label: 'home'        },
  { id: 'beauty',      label: 'beauty'      },
] as const;

type CategoryId = typeof CATEGORY_CHIPS[number]['id'];
const AUDIENCE_CATEGORY_IDS = new Set(['womens', 'mens']);

const PAGE_SIZE = 30;
const FILTER_MENU_WIDTH = 190;

// The "just in" strip is personalized: new arrivals from brands the
// viewer follows come first, backfilled with other recent products so
// it always has enough to show even when they follow few (or no)
// brands. Every other strip keeps its plain data-driven filter.
function getStripItems(
  strip: typeof EDITORIAL_STRIPS[number],
  allProducts: Product[],
  followedBrandIds: Set<string>,
  limit?: number,
): Product[] {
  if (strip.title !== 'just in') {
    const matched = allProducts.filter(strip.filter);
    return limit ? matched.slice(0, limit) : matched;
  }
  const byNew = [...allProducts].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const followed = byNew.filter(p => p.brand_id && followedBrandIds.has(p.brand_id));
  const rest = byNew.filter(p => !(p.brand_id && followedBrandIds.has(p.brand_id)));
  const combined = [...followed, ...rest];
  return limit ? combined.slice(0, limit) : combined;
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { isProductSaved, fetchBoards } = useBoardStore();
  const { unreadCount, fetchInbox } = useShareStore();
  const { products: allProducts, fetchProducts, notInterestedIds, markNotInterested, trendingCounts, fetchTrendingCounts, brandAudience, loaded: productsLoaded } = useProductsStore();
  const { boards } = useBoardStore();
  const { user } = useAuthStore();
  const [activeChip, setActiveChip] = useState<ChipId>('explore');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [followedBrandIds, setFollowedBrandIds] = useState<Set<string>>(new Set());
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [shareTarget, setShareTarget] = useState<Product | null>(null);
  const [quickActions, setQuickActions] = useState<{ product: Product; anchor: { x: number; y: number } } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewingStrip, setViewingStrip] = useState<typeof EDITORIAL_STRIPS[number] | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<{ x: number; y: number } | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  // Ink masthead needs light status bar icons; other tabs sit on Colors.bg
  // and use the dark default set in the root layout.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [])
  );

  // Board save counts — used to rank Trending
  const saveCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const board of boards) {
      for (const item of board.board_items ?? []) {
        counts.set(item.product_id, (counts.get(item.product_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [boards]);

  // Trending order is a snapshot, not a live recompute: it's taken when the
  // tab is (re-)entered or the underlying product set changes, but NOT on
  // every saveCounts/trendingCounts tick. Sorting live off `boards` meant
  // bookmarking a single product re-ranked the entire grid on every tap —
  // since MasonryGrid buckets items into columns by array-index parity, a
  // re-sort scatters cards into different columns/positions mid-scroll,
  // which reads as the page jumping/refreshing.
  const trendingScoresRef = useRef<Map<string, number>>(new Map());
  const [trendingSnapshotTick, setTrendingSnapshotTick] = useState(0);
  useEffect(() => {
    if (activeChip !== 'trending') return;
    const scores = new Map<string, number>();
    for (const p of allProducts) {
      scores.set(p.id, (trendingCounts.get(p.id) ?? 0) + (saveCounts.get(p.id) ?? 0) * 2);
    }
    trendingScoresRef.current = scores;
    setTrendingSnapshotTick(t => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChip, allProducts]);

  // Products already surfaced in the editorial strips above the grid
  // (explore mode only) — kept out of the main grid so nothing appears
  // twice on the same screen.
  const editorialProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const strip of EDITORIAL_STRIPS) {
      for (const p of getStripItems(strip, allProducts, followedBrandIds, 10)) {
        ids.add(p.id);
      }
    }
    return ids;
  }, [allProducts, followedBrandIds]);

  const visibleProducts = useMemo(() => {
    let base = allProducts.filter(p => !notInterestedIds.has(p.id));
    if (activeCategory !== 'all') {
      base = AUDIENCE_CATEGORY_IDS.has(activeCategory)
        // 'womens'/'mens' include 'unisex' brands too — a unisex item is
        // relevant to both, not neither.
        ? base.filter(p => {
            const audience = p.brand_id ? brandAudience.get(p.brand_id) : undefined;
            return audience === activeCategory || audience === 'unisex';
          })
        : base.filter(p => p.category === activeCategory);
    }
    if (activeChip === 'new') {
      return [...base].sort((a, b) =>
        (b.created_at ?? '').localeCompare(a.created_at ?? '')
      );
    }
    if (activeChip === 'trending') {
      // Blend: platform-wide saves (global popularity) + personal saves × 2
      // (your taste amplifies the signal). As more users join, the global
      // count becomes increasingly meaningful on its own.
      const score = (id: string) => trendingScoresRef.current.get(id) ?? 0;
      return [...base].sort((a, b) => score(b.id) - score(a.id));
    }
    // explore — store order (ranked by taste), minus whatever's already
    // shown in the editorial strips just above this grid
    return base.filter(p => !editorialProductIds.has(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, notInterestedIds, activeCategory, brandAudience, activeChip, trendingSnapshotTick, editorialProductIds]);

  const pagedProducts = visibleProducts.slice(0, visibleCount);
  const hasMore = visibleCount < visibleProducts.length;

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeChip, activeCategory]);
  useEffect(() => { fetchInbox(); fetchProducts(); fetchTrendingCounts(); }, []);
  useEffect(() => {
    if (!user) return;
    fetchFollowedBrands(user.id).then(brands => setFollowedBrandIds(new Set(brands.map(b => b.id))));
  }, [user]);

  function handleScroll(e: any) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) {
      setVisibleCount(c => c + PAGE_SIZE);
    }
  }

  function handleSave(product: Product) {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaveTarget(product);
  }

  function handleQuickActions(product: Product, anchor: { x: number; y: number }) {
    setQuickActions({ product, anchor });
  }

  const quickActionsList: QuickAction[] = quickActions ? [
    {
      key: 'save', label: 'Save',
      icon: (color) => <BookmarkIcon color={color} size={18} />,
      onPress: () => setSaveTarget(quickActions.product),
    },
    {
      key: 'share', label: 'Share',
      icon: (color) => <ShareIcon color={color} size={18} />,
      onPress: () => setShareTarget(quickActions.product),
    },
    {
      key: 'remove', label: 'Remove',
      icon: (color) => <CloseIcon color={color} size={14} />,
      onPress: () => markNotInterested(quickActions.product),
    },
  ] : [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // fetchProducts() no-ops once already loaded (see useProductsStore), so
    // this is just the retry path for a feed that failed to load initially.
    await Promise.all([fetchBoards(), fetchInbox(), fetchProducts()]);
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.root}>
      {/* Ink masthead */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
        <View style={styles.titleRow}>
          <Logo width={84} color={Colors.bg} />
          <Pressable style={styles.inboxBtn} onPress={() => router.push('/inbox')} hitSlop={8}>
            <InboxIcon size={22} color={Colors.bg} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Feed mode chips + category filter, one row */}
        <View style={styles.chipsRow}>
          <View style={styles.chips}>
            {CHIPS.map(chip => (
              <Pressable
                key={chip.id}
                style={[styles.chip, activeChip === chip.id && styles.chipActive]}
                onPress={() => setActiveChip(chip.id)}
              >
                <Text style={[styles.chipText, activeChip === chip.id && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.filterBtn, activeCategory !== 'all' && styles.chipActive]}
            onPress={(e) => setFilterAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
          >
            <FilterIcon color={activeCategory !== 'all' ? Colors.ink : 'rgba(255,255,255,0.58)'} size={13} />
            <Text style={[styles.chipText, activeCategory !== 'all' && styles.chipTextActive]} numberOfLines={1}>
              {activeCategory === 'all' ? 'filter' : CATEGORY_CHIPS.find(c => c.id === activeCategory)?.label}
            </Text>
          </Pressable>
        </View>
        </View>
      </View>

      {/* Category filter dropdown — anchored to wherever the filter button was tapped */}
      <Modal transparent visible={!!filterAnchor} animationType="none" onRequestClose={() => setFilterAnchor(null)}>
        <TouchableWithoutFeedback onPress={() => setFilterAnchor(null)}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        {filterAnchor && (
          <View
            style={[
              styles.filterMenu,
              {
                top: filterAnchor.y + 10,
                left: Math.min(Math.max(filterAnchor.x - FILTER_MENU_WIDTH + 24, 12), screenWidth - FILTER_MENU_WIDTH - 12),
              },
            ]}
          >
            {CATEGORY_CHIPS.map(cat => (
              <Pressable
                key={cat.id}
                style={styles.filterMenuRow}
                onPress={() => { setActiveCategory(cat.id); setFilterAnchor(null); }}
              >
                <Text style={[styles.filterMenuRowText, activeCategory === cat.id && styles.filterMenuRowTextActive]}>
                  {cat.label}
                </Text>
                {activeCategory === cat.id && <CheckIcon color={Colors.accentLime} size={14} />}
              </Pressable>
            ))}
          </View>
        )}
      </Modal>

      {/* Expanded strip view (explore only) */}
      {viewingStrip ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={[styles.expandedHeader, { backgroundColor: viewingStrip.bg }]}>
            <Pressable onPress={() => setViewingStrip(null)} hitSlop={8}>
              <ChevronLeftIcon color={viewingStrip.fg} size={22} />
            </Pressable>
            <Text style={[styles.expandedTitle, { color: viewingStrip.fg }]}>{viewingStrip.title}</Text>
            <View style={{ width: 22 }} />
          </View>
          <MasonryGrid
            items={getStripItems(viewingStrip, allProducts, followedBrandIds)}
            keyExtractor={p => p.id}
            renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={handleSave} onNotInterested={markNotInterested} onQuickActions={handleQuickActions} />}
          />
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollsToTop={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          onScroll={handleScroll}
          scrollEventThrottle={200}
        >
          {/* Editorial strips — explore mode only */}
          {activeChip === 'explore' && EDITORIAL_STRIPS.map((strip) => {
            const items = getStripItems(strip, allProducts, followedBrandIds, 10);
            if (!items.length) return null;
            return (
              <View key={strip.title}>
                <Pressable style={[styles.editorialCard, { backgroundColor: strip.bg }]} onPress={() => setViewingStrip(strip)}>
                  <View style={styles.editorialCardContent}>
                    <Text style={[styles.editorialTitle, { color: strip.fg }]}>{strip.title}</Text>
                    <Text style={[styles.editorialSub, { color: strip.fg }]}>{strip.subtitle}</Text>
                    <Text style={[styles.editorialLink, { color: strip.fg }]}>see all →</Text>
                  </View>
                </Pressable>
                <View style={styles.stripWrapper}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripScroll} scrollsToTop={false}>
                    {items.map(p => (
                      <Pressable key={p.id} style={styles.stripCard} onPress={() => openProduct(p.id)}>
                        <Image source={{ uri: p.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        <View style={styles.stripInfo}>
                          <Text style={styles.stripBrand} numberOfLines={1}>{p.brand}</Text>
                          <Text style={styles.stripName} numberOfLines={2}>{p.name}</Text>
                          <Text style={styles.stripPrice}>${p.price}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            );
          })}

          {/* Divider before main grid */}
          {activeChip === 'explore' && allProducts.length > 0 && (
            <View style={styles.gridDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>your trove</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Main masonry grid */}
          <MasonryGrid
            items={pagedProducts}
            keyExtractor={p => p.id}
            renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={handleSave} onNotInterested={markNotInterested} onQuickActions={handleQuickActions} />}
          />

          {hasMore
            ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 8, marginBottom: 16 }} />
            : pagedProducts.length > 0
              ? <View style={styles.caughtUp}>
                  <View style={styles.caughtUpLine} />
                  <Text style={styles.caughtUpText}>you're all caught up</Text>
                  <View style={styles.caughtUpLine} />
                </View>
              : !productsLoaded
                ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
                : null
          }
        </ScrollView>
      )}

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
      <ShareSheet product={shareTarget} onClose={() => setShareTarget(null)} />
      <QuickActionsMenu
        anchor={quickActions?.anchor ?? null}
        actions={quickActionsList}
        onDismiss={() => setQuickActions(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.ink, zIndex: 10 },
  headerContent: { maxWidth: 1100, alignSelf: 'center', width: '100%' },

  titleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     14,
  },
  inboxBtn: { padding: 4 },
  badge: {
    position: 'absolute', top: -4, right: -6, minWidth: 17, height: 17, borderRadius: 8.5,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { ...Typography.caption, fontSize: 10, color: '#fff' },

  chipsRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingTop:        2,
    paddingBottom:     16,
    gap:               Spacing[3],
  },
  chips: { flexDirection: 'row', gap: Spacing[3] },
  chip:  {
    paddingHorizontal: 16,
    paddingVertical:   Spacing[2],
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.22)',
  },
  chipActive:     { backgroundColor: Colors.accentLime, borderColor: Colors.accentLime },
  chipText:       { ...Typography.caption, color: 'rgba(255,255,255,0.58)' },
  chipTextActive: { color: Colors.ink },

  filterBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   Spacing[2],
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.22)',
    maxWidth:          130,
  },

  filterMenu: {
    position:        'absolute',
    width:            FILTER_MENU_WIDTH,
    backgroundColor:  Colors.surface,
    borderRadius:     Radius.card,
    paddingVertical:  Spacing[2],
    ...Shadows.elevated,
  },
  filterMenuRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   10,
  },
  filterMenuRowText:       { ...Typography.body, fontSize: 14, color: Colors.text },
  filterMenuRowTextActive: { fontFamily: 'Mulish_800ExtraBold' },

  caughtUp: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 24,
    marginTop:      24,
    marginBottom:   40,
    gap:            12,
  },
  caughtUpLine: { flex: 1, height: 0.5, backgroundColor: Colors.border },
  caughtUpText: { ...Typography.label, color: Colors.textMuted, letterSpacing: 0.4 },

  // Expanded strip view header
  expandedHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   20,
  },
  expandedTitle: { fontFamily: 'Mulish_900Black', fontSize: 20, letterSpacing: -0.5 },

  // Editorial section cards — background bleeds full-width
  editorialCard: {
    marginTop: 24,
  },
  // Inner content constrained to the same column as the header logo
  editorialCardContent: {
    maxWidth:          1100,
    alignSelf:         'center',
    width:             '100%',
    paddingHorizontal: 20,
    paddingTop:        28,
    paddingBottom:     24,
  },
  editorialTitle: {
    fontFamily:    'Mulish_900Black',
    fontSize:      52,
    letterSpacing: -2.2,
    lineHeight:    52,
    marginBottom:  10,
  },
  editorialSub: {
    ...Typography.body,
    fontSize:      15,
    lineHeight:    22,
    marginBottom:  20,
    opacity:       0.72,
  },
  editorialLink: {
    ...Typography.caption,
    fontSize:      11,
    letterSpacing: 0.4,
    opacity:       0.8,
  },

  // Product rail below each editorial section
  stripWrapper: { maxWidth: 1100, alignSelf: 'center', width: '100%' },
  stripScroll: { paddingLeft: 20, paddingRight: 16, paddingTop: 16, paddingBottom: 4, gap: Spacing[3] },
  stripCard: {
    width:           160,
    height:          213,
    borderRadius:    Radius.card,
    overflow:        'hidden',
    backgroundColor: Colors.stoneSoft,
  },
  stripInfo: {
    position:   'absolute',
    bottom:     0, left: 0, right: 0,
    padding:    Spacing[3],
    paddingTop: Spacing[5],
    backgroundColor: 'rgba(13,16,53,0.58)',
  },
  stripBrand: { ...Typography.label, color: Colors.accentBlueSoft, marginBottom: 3 },
  stripName:  { ...Typography.cardTitle, fontSize: 12, color: '#fff', marginBottom: 4, lineHeight: 16 },
  stripPrice: { ...Typography.label, fontSize: 11, letterSpacing: 0.1, color: 'rgba(255,255,255,0.7)' },

  // Divider before main grid
  gridDivider: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 20,
    marginTop:      32,
    marginBottom:   16,
    gap:            12,
  },
  dividerLine:  { flex: 1, height: 0.5, backgroundColor: Colors.border },
  dividerLabel: { ...Typography.label, color: Colors.textMuted, letterSpacing: 0.5 },
});
