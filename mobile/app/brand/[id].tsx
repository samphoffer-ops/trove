import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
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
import { goBack } from '@/lib/navigation';
import { MasonryGrid } from '@/components/MasonryGrid';
import { ProductCard } from '@/components/ProductCard';
import { SaveSheet } from '@/components/SaveSheet';

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

  useEffect(() => {
    if (!id) return;
    supabase.from('brands').select('*').eq('id', id).single()
      .then(({ data }) => data && setBrand(data as Brand));
    supabase.from('products').select('*').eq('brand_id', id).eq('status', 'active')
      .then(({ data }) => setProducts((data ?? []) as Product[]));
    fetchBrandFollowerCount(id).then(setFollowerCount);
    if (user) isBrandFollowed(user.id, id).then(setIsFollowing);
  }, [id, user]);

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

  return (
    <WebFrame maxWidth={480}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/(tabs)/feed')} hitSlop={8}><ChevronLeftIcon /></Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>{brand.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.brandName}>{brand.name}</Text>
          <Pressable onPress={() => Linking.openURL(`https://${brand.domain}`)}>
            <Text style={styles.website}>{brand.domain}</Text>
          </Pressable>
          <Text style={styles.followerText}>{followerCount} follower{followerCount !== 1 ? 's' : ''}</Text>

          <Pressable style={[styles.followBtn, isFollowing && styles.followBtnActive]} onPress={toggleFollow}>
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        </View>

        {products.length === 0 ? (
          <Text style={styles.empty}>No products live yet.</Text>
        ) : (
          <MasonryGrid
            items={products}
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
