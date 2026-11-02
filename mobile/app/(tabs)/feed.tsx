import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedRef, useScrollOffset } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EDITS } from '@/data/products';
import { useProductsStore } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchFollowedBrands } from '@/lib/social';
import { ProductCard } from '@/components/ProductCard';
import { MasonryGrid } from '@/components/MasonryGrid';
import { EditorialBento } from '@/components/EditorialBento';
import { SaveSheet } from '@/components/SaveSheet';
import { QuickActionsMenu, QuickAction } from '@/components/QuickActionsMenu';
import { GlassHeader, GLASS_HEADER_HEIGHT } from '@/components/GlassHeader';
import { BookmarkIcon, CloseIcon } from '@/components/Icons';
import { Product } from '@/types';
import { Colors, Typography, Spacing, DisplayScaling } from '@/lib/theme';
import * as haptics from '@/lib/haptics';

// A bento block follows each grid segment; segment lengths cycle through
// this list so blocks land every 8–12 cards (docs/design-spec.md §7 Feed)
// without a mechanical beat.
const SEGMENT_LENGTHS = [10, 8, 12, 9, 11];
const BENTO_SIZE = 3;
// Grid cards rendered per page; bentos ride along with their segment.
const PAGE_SIZE = 30;

// Brand order in "Just in" and the "New from [Brand]" edits is shuffled with
// a seed fixed for the app session rather than Math.random(), so the layout
// doesn't reshuffle on every re-render. A new session gets a new mix.
const FEED_SESSION_SEED = Math.floor(Math.random() * 2 ** 31);
const JUST_IN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const JUST_IN_MIN_CANDIDATES = 40;
// "New from [Brand]" is a rare note, not the feed's rhythm: at most this many
// per session, and only for brands with products inside the Just-in window.
const MAX_NEW_FROM = 2;

function seededRank(key: string): number {
  // FNV-1a over seed + key — cheap, stable, well-spread
  let h = 2166136261 ^ FEED_SESSION_SEED;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const brandKey = (p: Product) => p.brand_id ?? p.brand;
const newestFirst = (a: Product, b: Product) => (b.created_at ?? '').localeCompare(a.created_at ?? '');

// "Just in" is personalized: new arrivals from brands the viewer follows
// come first, backfilled with other recent products.
//
// Brands are interleaved, one product per brand per pass. A plain
// newest-first sort let whichever brand was scraped last fill the whole
// edit — intake adds a brand's entire catalog in one go, so its products
// all share essentially the same created_at.
function justInItems(allProducts: Product[], followedBrandIds: Set<string>): Product[] {
  const byNew = [...allProducts].sort(newestFirst);
  // "Recent" relative to the newest product, not the wall clock, so a quiet
  // stretch with no new intakes still shows something.
  const newest = Date.parse(byNew[0]?.created_at ?? '') || Date.now();
  let recent = byNew.filter(p => newest - (Date.parse(p.created_at ?? '') || 0) <= JUST_IN_WINDOW_MS);
  if (recent.length < JUST_IN_MIN_CANDIDATES) recent = byNew.slice(0, 200);

  const groups = new Map<string, Product[]>(); // each brand's products stay newest-first
  for (const p of recent) {
    const key = brandKey(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const isFollowed = (key: string) => followedBrandIds.has(key);
  const brandKeys = [...groups.keys()].sort((a, b) =>
    Number(isFollowed(b)) - Number(isFollowed(a)) || seededRank(a) - seededRank(b));

  const combined: Product[] = [];
  for (let round = 0; ; round++) {
    let added = false;
    for (const key of brandKeys) {
      const next = groups.get(key)![round];
      if (next) { combined.push(next); added = true; }
    }
    if (!added) break;
  }
  return combined;
}

interface ResolvedEdit { key: string; title: string; items: () => Product[] }

// The queue of mini-edits, in the order bentos use them. "New from [Brand]"
// expands to at most MAX_NEW_FROM brand edits, slotted in between the named
// edits rather than stacked after them.
function resolveEdits(products: Product[], followedBrandIds: Set<string>): ResolvedEdit[] {
  const named: ResolvedEdit[] = [];
  const newFrom: ResolvedEdit[] = [];
  for (const edit of EDITS) {
    if (edit.kind === 'just-in') {
      named.push({ key: edit.id, title: edit.title, items: () => justInItems(products, followedBrandIds) });
    } else if (edit.kind === 'filter' && edit.filter) {
      named.push({ key: edit.id, title: edit.title, items: () => products.filter(edit.filter!) });
    } else if (edit.kind === 'new-from-brand') {
      const newest = Math.max(0, ...products.map(p => Date.parse(p.created_at ?? '') || 0));
      const byBrand = new Map<string, Product[]>();
      for (const p of products) {
        if (newest - (Date.parse(p.created_at ?? '') || 0) > JUST_IN_WINDOW_MS) continue;
        const key = brandKey(p);
        if (!byBrand.has(key)) byBrand.set(key, []);
        byBrand.get(key)!.push(p);
      }
      const keys = [...byBrand.keys()].sort((a, b) => seededRank(a) - seededRank(b));
      for (const key of keys) {
        if (newFrom.length >= MAX_NEW_FROM) break;
        const items = byBrand.get(key)!;
        if (items.length < BENTO_SIZE) continue;
        newFrom.push({ key: `${edit.id}-${key}`, title: `${edit.title} ${items[0].brand}`, items: () => [...items].sort(newestFirst) });
      }
    }
  }
  // Just in, a named edit, then alternate: … New from, named, New from …
  const edits: ResolvedEdit[] = named.slice(0, 2);
  const rest = named.slice(2);
  while (rest.length || newFrom.length) {
    if (newFrom.length) edits.push(newFrom.shift()!);
    if (rest.length) edits.push(rest.shift()!);
  }
  return edits;
}

type FeedBlock =
  | { type: 'grid';  key: string; items: Product[] }
  | { type: 'bento'; key: string; title: string; items: Product[] };

// Ranked products cut into grid segments with a bento after each. Nothing
// appears twice: bento picks skip anything already placed, and the grid
// skips anything a bento took. Once the edits run out the grid just continues.
function buildFeed(products: Product[], followedBrandIds: Set<string>): FeedBlock[] {
  const edits = resolveEdits(products, followedBrandIds);
  const used = new Set<string>();
  const blocks: FeedBlock[] = [];
  let next = 0;

  for (let seg = 0; ; seg++) {
    const length = SEGMENT_LENGTHS[seg % SEGMENT_LENGTHS.length];
    const items: Product[] = [];
    while (items.length < length && next < products.length) {
      const p = products[next++];
      if (!used.has(p.id)) { used.add(p.id); items.push(p); }
    }
    if (!items.length) break;

    const last = blocks[blocks.length - 1];
    if (last?.type === 'grid') last.items.push(...items);
    else blocks.push({ type: 'grid', key: `grid-${seg}`, items });
    if (items.length < length) break; // out of products; never end on a bento

    while (edits.length) {
      const edit = edits.shift()!;
      const picks = edit.items().filter(p => !used.has(p.id)).slice(0, BENTO_SIZE);
      if (picks.length < BENTO_SIZE) continue;
      picks.forEach(p => used.add(p.id));
      blocks.push({ type: 'bento', key: `bento-${edit.key}`, title: edit.title, items: picks });
      break;
    }
  }
  return blocks;
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { isProductSaved, fetchBoards } = useBoardStore();
  const { products: allProducts, fetchProducts, notInterestedIds, markNotInterested, loading: productsLoading } = useProductsStore();
  const { user } = useAuthStore();
  const [followedBrandIds, setFollowedBrandIds] = useState<Set<string>>(new Set());
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [quickActions, setQuickActions] = useState<{ product: Product; anchor: { x: number; y: number } } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [firstFetchDone, setFirstFetchDone] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);

  // Content starts below the floating glass header, then scrolls under it.
  const headerInset = insets.top + GLASS_HEADER_HEIGHT;

  // Store order is the ranked feed.
  const feedProducts = useMemo(
    () => allProducts.filter(p => !notInterestedIds.has(p.id)),
    [allProducts, notInterestedIds],
  );
  const blocks = useMemo(() => buildFeed(feedProducts, followedBrandIds), [feedProducts, followedBrandIds]);

  // Render whole blocks until PAGE_SIZE-many grid cards are on screen.
  const pagedBlocks = useMemo(() => {
    const out: FeedBlock[] = [];
    let shown = 0;
    for (const block of blocks) {
      if (shown >= visibleCount) break;
      if (block.type === 'grid') {
        const items = block.items.slice(0, visibleCount - shown);
        shown += items.length;
        out.push(items.length === block.items.length ? block : { ...block, items });
      } else {
        out.push(block);
      }
    }
    return out;
  }, [blocks, visibleCount]);
  const totalGridCards = useMemo(
    () => blocks.reduce((n, b) => n + (b.type === 'grid' ? b.items.length : 0), 0),
    [blocks],
  );
  const hasMore = visibleCount < totalGridCards;

  const isLoading = !firstFetchDone || (productsLoading && feedProducts.length === 0);
  const isEmpty = !isLoading && feedProducts.length === 0;

  useEffect(() => {
    fetchProducts().finally(() => setFirstFetchDone(true));
  }, []);
  useEffect(() => {
    if (!user) return;
    fetchFollowedBrands(user.id).then(brands => setFollowedBrandIds(new Set(brands.map(b => b.id))));
  }, [user]);

  function handleScroll(e: any) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) {
      // onScroll fires every frame (parallax needs it); only grow once per render
      setVisibleCount(c => c === visibleCount ? c + PAGE_SIZE : c);
    }
  }

  function handleSave(product: Product) {
    setSaveTarget(product);
  }

  function handleQuickActions(product: Product, anchor: { x: number; y: number }) {
    setQuickActions({ product, anchor });
  }

  const quickActionsList: QuickAction[] = quickActions ? [
    {
      key: 'save', label: 'Save',
      icon: (color) => <BookmarkIcon color={color} size={18} />,
      onPress: () => { haptics.saveToBoard(); setSaveTarget(quickActions.product); },
    },
    {
      key: 'not-for-me', label: 'Not for me',
      icon: (color) => <CloseIcon color={color} size={14} />,
      onPress: () => { haptics.notForMe(); markNotInterested(quickActions.product); },
    },
  ] : [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Forced, so a loaded feed gets a fresh draw (rank_products_for_user
    // samples randomly) instead of no-oping; also the retry path for a feed
    // that failed to load initially.
    await Promise.all([fetchBoards(), fetchProducts({ force: true })]);
    setVisibleCount(PAGE_SIZE);
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollsToTop={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} progressViewOffset={headerInset} />}
        contentContainerStyle={isEmpty ? styles.contentEmpty : [styles.content, { paddingTop: headerInset }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {isLoading ? (
          // Quiet first load: no coral spinner, no gray boxes
          <ActivityIndicator color={Colors.textLight} style={styles.firstLoad} />
        ) : isEmpty ? (
          <View style={[styles.empty, { paddingTop: headerInset }]}>
            <Text {...DisplayScaling} style={styles.emptyTitle} accessibilityRole="header">That's everything, for now</Text>
            <Text style={styles.emptyBody}>New pieces land as brands restock. Pull down to refresh.</Text>
          </View>
        ) : (
          <>
            {/* Masthead: the feed's opening, so the grid doesn't start cold */}
            <View style={styles.masthead}>
              <Text {...DisplayScaling} style={styles.mastheadTitle} accessibilityRole="header">Your edit</Text>
              <View style={styles.rule} />
            </View>
            {/* Each block is a direct child of the scroll content: bentos read their own y for parallax */}
            {pagedBlocks.map(block => block.type === 'grid' ? (
              <MasonryGrid
                key={block.key}
                items={block.items}
                keyExtractor={p => p.id}
                itemHeight={p => p.ratio}
                renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={handleSave} onQuickActions={handleQuickActions} />}
              />
            ) : (
              <EditorialBento
                key={block.key}
                title={block.title}
                products={block.items}
                scrollY={scrollY}
                isSaved={isProductSaved}
                onSave={handleSave}
                onQuickActions={handleQuickActions}
              />
            ))}

            {hasMore
              ? <ActivityIndicator color={Colors.textLight} style={styles.pageLoad} />
              : <View style={styles.caughtUp}>
                  <View style={styles.caughtUpLine} />
                  <Text style={styles.caughtUpText}>you're all caught up</Text>
                  <View style={styles.caughtUpLine} />
                </View>
            }
          </>
        )}
      </Animated.ScrollView>

      {/* After the scroll view so it draws on top of the content */}
      <GlassHeader />

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
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
  content:      { paddingBottom: 100 },
  contentEmpty: { flexGrow: 1 },
  masthead:      { paddingHorizontal: Spacing.screen, paddingTop: Spacing[4], paddingBottom: Spacing[5] },
  mastheadTitle: { ...Typography.displayXl, color: Colors.text, marginLeft: -2, marginBottom: Spacing[5] },
  rule:          { height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderStrong },

  firstLoad: { marginTop: Spacing[6] * 2 },
  pageLoad:  { marginTop: Spacing[3], marginBottom: Spacing[5] },

  // Designed empty state: full-bleed coral, no product imagery (§2, §9).
  // Header sits low and left, in the thumb zone, not centered.
  empty: {
    flex:              1,
    justifyContent:    'flex-end',
    backgroundColor:   Colors.accent,
    paddingHorizontal: Spacing.screen,
    paddingBottom:     Spacing[6] * 4,
  },
  emptyTitle: {
    ...Typography.displayXl,
    color:        Colors.bg,
    marginBottom: Spacing[5],
    marginLeft:   -2,   // optical: italic overhang
  },
  emptyBody: {
    ...Typography.body,
    color:    Colors.ink,   // warm white body text on coral fails contrast
    maxWidth: 300,
  },

  caughtUp: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: Spacing.screen,
    marginTop:      24,
    marginBottom:   40,
    gap:            12,
  },
  caughtUpLine: { flex: 1, height: 0.5, backgroundColor: Colors.border },
  caughtUpText: { ...Typography.label, color: Colors.textMuted },
});
