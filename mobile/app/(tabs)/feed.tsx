import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Sticky header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>for you</Text>
          <Pressable style={styles.inboxBtn} onPress={() => router.push('/inbox')} hitSlop={8}>
            <InboxIcon size={22} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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

      {viewingStrip ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.expandedHeader}>
            <Pressable onPress={() => setViewingStrip(null)} hitSlop={8}>
              <ChevronLeftIcon />
            </Pressable>
            <Text style={styles.expandedTitle}>{viewingStrip.title}</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          onScroll={handleScroll}
          scrollEventThrottle={200}
        >
          {/* Editorial strips */}
          {activeCategory === 'all' && EDITORIAL_STRIPS.map(strip => {
            const items = allProducts.filter(strip.filter).slice(0, 8);
            if (!items.length) return null;
            return (
              <View key={strip.title} style={styles.strip}>
                <View style={styles.stripHeader}>
                  <Text style={styles.stripTitle}>{strip.title}</Text>
                  <Pressable onPress={() => setViewingStrip(strip)} hitSlop={8}>
                    <Text style={styles.seeAll}>see all</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripScroll}>
                  {items.map(p => (
                    <Pressable key={p.id} style={styles.stripCard} onPress={() => openProduct(p.id)}>
                      <Image source={{ uri: p.image }} style={styles.stripImg} contentFit="cover" />
                      <View style={styles.stripInfo}>
                        <Text style={styles.stripBrand}>{p.brand}</Text>
                        <Text style={styles.stripName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.stripPrice}>${p.price}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            );
          })}

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
  header: { backgroundColor: Colors.bg, zIndex: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  title:  { ...Typography.display, color: Colors.text },
  inboxBtn: { padding: 2 },
  badge: {
    position: 'absolute', top: -4, right: -6, minWidth: 17, height: 17, borderRadius: 8.5,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { ...Typography.caption, fontSize: 10, color: '#fff' },
  chips:  { paddingHorizontal: 16, paddingVertical: Spacing[3], gap: Spacing[3] },
  chip:   { paddingHorizontal: 15, paddingVertical: Spacing[3], borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText:   { ...Typography.cardTitle, color: Colors.textMuted },
  chipTextActive: { color: Colors.accentLime },
  expandedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Spacing[3] },
  expandedTitle:  { ...Typography.headline, color: Colors.text },
  strip:       { marginBottom: Spacing[1] },
  stripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, paddingBottom: 10, paddingTop: Spacing[2] },
  stripTitle:  { ...Typography.headline, color: Colors.text },
  seeAll:      { ...Typography.caption, color: Colors.accent },
  stripScroll: { paddingHorizontal: 16, gap: Spacing[3], paddingBottom: 16 },
  stripCard:   { width: 140, borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.surface },
  stripImg:    { width: 140, height: 186, backgroundColor: Colors.stoneSoft },
  stripInfo:   { padding: Spacing[3] },
  stripBrand:  { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing[1] },
  stripName:   { ...Typography.cardTitle, color: Colors.text, marginBottom: Spacing[1] },
  stripPrice:  { ...Typography.cardTitle, color: Colors.accentBlue },
});
