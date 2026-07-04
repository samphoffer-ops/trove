import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_STEPS, EDITORIAL_STRIPS } from '@/data/products';
import { useProductsStore, getProducts } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useShareStore } from '@/store/useShareStore';
import { ProductCard } from '@/components/ProductCard';
import { MasonryGrid } from '@/components/MasonryGrid';
import { SaveSheet } from '@/components/SaveSheet';
import { Logo } from '@/components/Logo';
import { InboxIcon, ChevronLeftIcon } from '@/components/Icons';
import { Product } from '@/types';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { openProduct } from '@/lib/navigation';

const CATEGORIES = [
  { id: 'all', label: 'all' },
  ...ONBOARDING_STEPS[2].options.map(o => ({ id: o.id, label: o.label })),
];

const PAGE_SIZE = 30;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { isProductSaved, fetchBoards } = useBoardStore();
  const { unreadCount, fetchInbox } = useShareStore();
  const { products: allProducts, fetchProducts, notInterestedIds, markNotInterested } = useProductsStore();
  const [activeCategory, setActiveCategory] = useState('all');
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewingStrip, setViewingStrip] = useState<typeof EDITORIAL_STRIPS[number] | null>(null);

  const { products, hasMore } = getProducts({ category: activeCategory, perPage: visibleCount });

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeCategory]);
  useEffect(() => { fetchInbox(); fetchProducts(); }, []);

  function handleScroll(e: any) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) {
      setVisibleCount(c => c + PAGE_SIZE);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBoards(), fetchInbox()]);
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

        {/* Category chips on ink */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} scrollsToTop={false}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.id}
              style={[styles.chip, activeCategory === cat.id && styles.chipActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Text style={[styles.chipText, activeCategory === cat.id && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        </View>
      </View>

      {/* Expanded strip view */}
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
            items={allProducts.filter(viewingStrip.filter)}
            keyExtractor={p => p.id}
            renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={setSaveTarget} onNotInterested={markNotInterested} />}
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
          {/* Editorial strips */}
          {activeCategory === 'all' && EDITORIAL_STRIPS.map((strip, idx) => {
            const items = allProducts.filter(strip.filter).slice(0, 10);
            if (!items.length) return null;
            return (
              <View key={strip.title}>
                {/* Full-bleed editorial section card — bg bleeds edge-to-edge,
                    inner content aligns to the same column as the header logo */}
                <Pressable style={[styles.editorialCard, { backgroundColor: strip.bg }]} onPress={() => setViewingStrip(strip)}>
                  <View style={styles.editorialCardContent}>
                    <Text style={[styles.editorialNum, { color: strip.fg }]}>{idx + 1}</Text>
                    <Text style={[styles.editorialTitle, { color: strip.fg }]}>{strip.title}</Text>
                    <Text style={[styles.editorialSub, { color: strip.fg }]}>{strip.subtitle}</Text>
                    <Text style={[styles.editorialLink, { color: strip.fg }]}>see all →</Text>
                  </View>
                </Pressable>

                {/* Product rail */}
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
            );
          })}

          {/* Divider before main grid */}
          {activeCategory === 'all' && allProducts.length > 0 && (
            <View style={styles.gridDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>everything</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Main masonry feed */}
          <MasonryGrid
            items={products}
            keyExtractor={p => p.id}
            renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={setSaveTarget} onNotInterested={markNotInterested} />}
          />
          {hasMore && <ActivityIndicator color={Colors.accent} style={{ marginTop: 8, marginBottom: 16 }} />}
        </ScrollView>
      )}

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
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

  chips: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14, gap: Spacing[3] },
  chip:  {
    paddingHorizontal: 14,
    paddingVertical:   Spacing[2],
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.22)',
  },
  chipActive:     { backgroundColor: Colors.accentLime, borderColor: Colors.accentLime },
  chipText:       { ...Typography.caption, color: 'rgba(255,255,255,0.58)' },
  chipTextActive: { color: Colors.ink },

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
  editorialNum: {
    fontFamily:    'Mulish_900Black',
    fontSize:      10,
    letterSpacing: 2,
    marginBottom:  10,
    opacity:       0.5,
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
  stripScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, gap: Spacing[3] },
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
