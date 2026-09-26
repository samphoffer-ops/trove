import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useBoardStore } from '@/store/useBoardStore';
import { isBrandFollowed, fetchBrandFollowerCount, followBrand, unfollowBrand } from '@/lib/social';
import { ChevronLeftIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { Brand, Product } from '@/types';
import { WebFrame } from '@/components/WebFrame';
import { goBack, openExternal } from '@/lib/navigation';
import { MasonryGrid } from '@/components/MasonryGrid';
import { ProductCard } from '@/components/ProductCard';
import { SaveSheet } from '@/components/SaveSheet';

// Rendered in pages as you scroll, like the feed. The grid isn't
// virtualized and every card with extra photos mounts its own swipeable
// gallery, so rendering a full catalog at once — Schott is 438 products
// since the full-catalog scrape — is enough to crash the app on a phone.
const PAGE_SIZE = 30;
// Everything a card needs; `*` also pulled each product's 1024-dim
// embedding (~4KB/row), which the app never reads.
const PRODUCT_COLUMNS = 'id, brand_id, brand, name, price, prices, image, images, ratio, url, category, styles, description, source, status, created_at, last_seen_at, search_keywords';

export default function BrandProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { isProductSaved } = useBoardStore();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [productsLoaded, setProductsLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('brands').select('*').eq('id', id).single()
      .then(({ data }) => data && setBrand(data as Brand));
    setVisibleCount(PAGE_SIZE);
    setProductsLoaded(false);
    supabase.from('products').select(PRODUCT_COLUMNS).eq('brand_id', id).eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setProducts((data ?? []) as Product[]); setProductsLoaded(true); });
    fetchBrandFollowerCount(id).then(setFollowerCount);
    if (user) isBrandFollowed(user.id, id).then(setIsFollowing);
  }, [id, user]);

  const hasMore = visibleCount < products.length;
  function handleScroll(e: any) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) {
      setVisibleCount(c => c + PAGE_SIZE);
    }
  }

  async function toggleFollow() {
    if (!user || !id) return;
    if (isFollowing) {
      await unfollowBrand(user.id, id);
      setIsFollowing(false);
      setFollowerCount(n => n - 1);
    } else {
      await followBrand(user.id, id);
      setIsFollowing(true);
      setFollowerCount(n => n + 1);
    }
  }

  if (!brand) return null;

  // Default (wide) frame, like the feed: MasonryGrid picks its column
  // count from the window width, so inside a 480px frame a desktop window
  // got 5 columns of ~80px cards.
  return (
    <WebFrame>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/(tabs)/feed')} hitSlop={8}><ChevronLeftIcon /></Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>{brand.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={200}>
        <View style={styles.hero}>
          <Text style={styles.brandName}>{brand.name}</Text>
          <Pressable onPress={() => openExternal(`https://${brand.domain}`)}>
            <Text style={styles.website}>{brand.domain}</Text>
          </Pressable>
          <Text style={styles.followerText}>{followerCount} follower{followerCount !== 1 ? 's' : ''}</Text>

          <Pressable style={[styles.followBtn, isFollowing && styles.followBtnActive]} onPress={toggleFollow}>
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        </View>

        {!productsLoaded ? (
          // Used to fall straight through to "No products live yet." while
          // the query was still in flight.
          <ActivityIndicator style={{ marginTop: Spacing[6] }} color={Colors.textMuted} />
        ) : products.length === 0 ? (
          <Text style={styles.empty}>No products live yet.</Text>
        ) : (
          <MasonryGrid
            items={products.slice(0, visibleCount)}
            keyExtractor={p => p.id}
            renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={setSaveTarget} />}
          />
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  topBarTitle: { flex: 1, ...Typography.cardTitle, fontSize: 16, color: Colors.text, textAlign: 'center' },
  hero:        { alignItems: 'center', paddingVertical: Spacing[5], paddingHorizontal: 20 },
  brandName:   { ...Typography.display, color: Colors.text, marginBottom: Spacing[1], textAlign: 'center' },
  website:     { ...Typography.cardTitle, fontSize: 13.5, color: Colors.accentBlue, marginBottom: Spacing[2] },
  followerText:{ ...Typography.caption, fontSize: 13, color: Colors.textMuted, marginBottom: Spacing[4] },
  followBtn:   { borderWidth: 1.5, borderColor: Colors.text, borderRadius: Radius.full, paddingVertical: 12, paddingHorizontal: 32, alignItems: 'center' },
  followBtnActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  followBtnText:   { ...Typography.headline, fontSize: 15, color: Colors.text },
  followBtnTextActive: { color: Colors.accentLime },
  empty:       { ...Typography.body, color: Colors.textMuted, textAlign: 'center', paddingTop: 40 },
});
