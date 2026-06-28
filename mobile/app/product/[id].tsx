import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProductsStore, getProductById, fetchSimilarProducts } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { SaveSheet } from '@/components/SaveSheet';
import { ShareSheet } from '@/components/ShareSheet';
import { ChevronLeftIcon, BookmarkIcon, ShareIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing } from '@/lib/theme';
import { Product } from '@/types';
import { getAffiliateUrl } from '@/lib/affiliate';
import { WebFrame } from '@/components/WebFrame';
import { goBack } from '@/lib/navigation';

const PLACEHOLDER_DESC = 'A considered piece designed to wear and wear. Crafted with attention to material and fit — built to earn a place in your rotation, not just your cart.';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const { isProductSaved } = useBoardStore();
  const { user } = useAuthStore();
  const { loaded, fetchProducts } = useProductsStore();
  const [saveTarget,  setSaveTarget]  = useState<Product | null>(null);
  const [shareTarget, setShareTarget] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);

  useEffect(() => { fetchProducts(); }, []);

  const product = getProductById(id!);

  // Empty when the product has no embedding yet (still being backfilled) —
  // the section below just doesn't render rather than showing nothing useful.
  useEffect(() => {
    if (!product) return;
    fetchSimilarProducts(product.id).then(setSimilar);
  }, [product?.id]);

  // Weakest, passive taste signal — one row per user per product (not per
  // visit), via upsert so reopening the same item never duplicates/inflates it.
  useEffect(() => {
    if (!user || !product) return;
    supabase.from('product_views').upsert(
      { user_id: user.id, product_id: product.id },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
  }, [user, product?.id]);

  if (!loaded) {
    return (
      <WebFrame maxWidth={480}>
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
      </WebFrame>
    );
  }
  if (!product) return null;

  const saved = isProductSaved(product.id);

  return (
    <WebFrame maxWidth={480}>
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View style={styles.hero}>
          <Image source={{ uri: product.image }} style={styles.heroImg} contentFit="cover" />
          <Pressable style={[styles.backBtn, { top: insets.top + 12 }]} onPress={() => goBack('/(tabs)/feed')}>
            <ChevronLeftIcon />
          </Pressable>
          <View style={[styles.heroActions, { top: insets.top + 12 }]}>
            <Pressable style={styles.heroIconBtn} onPress={() => setShareTarget(product)}>
              <ShareIcon size={19} />
            </Pressable>
            <Pressable style={styles.heroIconBtn} onPress={() => setSaveTarget(product)}>
              <BookmarkIcon color={saved ? Colors.accent : Colors.text} filled={saved} size={20} />
            </Pressable>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {product.brand_id ? (
            <Pressable onPress={() => router.push(`/brand/${product.brand_id}`)}>
              <Text style={styles.brand}>{product.brand}</Text>
            </Pressable>
          ) : (
            <Text style={styles.brand}>{product.brand}</Text>
          )}
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>${product.price.toFixed(2)}</Text>
          <Text style={styles.desc}>{product.description ?? PLACEHOLDER_DESC}</Text>
          <View style={styles.tags}>
            {product.styles?.map(s => <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>)}
            {product.category && <View style={styles.tag}><Text style={styles.tagText}>{product.category}</Text></View>}
          </View>
        </View>

        {similar.length > 0 && (
          <View style={styles.similarSection}>
            <Text style={styles.similarTitle}>You might also like</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarScroll}>
              {similar.map(p => (
                <Pressable key={p.id} style={styles.similarCard} onPress={() => router.push(`/product/${p.id}`)}>
                  <Image source={{ uri: p.image }} style={styles.similarImg} contentFit="cover" />
                  <View style={styles.similarInfo}>
                    <Text style={styles.similarBrand}>{p.brand}</Text>
                    <Text style={styles.similarName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.similarPrice}>${p.price}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={styles.shopBtn} onPress={() => Linking.openURL(getAffiliateUrl(product))}>
          <Text style={styles.shopBtnText}>Shop now</Text>
        </Pressable>
        <Pressable style={[styles.saveBtn, saved && styles.saveBtnActive]} onPress={() => setSaveTarget(product)}>
          <BookmarkIcon color={saved ? Colors.accent : Colors.text} filled={saved} size={20} />
        </Pressable>
      </View>

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
      <ShareSheet product={shareTarget} onClose={() => setShareTarget(null)} />
    </View>
    </WebFrame>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  hero:       { width: '100%', aspectRatio: 3/4, backgroundColor: Colors.stoneSoft },
  heroImg:    { ...StyleSheet.absoluteFillObject },
  backBtn:    { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' },
  heroActions:{ position: 'absolute', right: 16, flexDirection: 'row', gap: 10 },
  heroIconBtn:{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' },
  body:       { padding: 20 },
  brand:      { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing[2] },
  name:       { ...Typography.display, color: Colors.text, marginBottom: Spacing[3] },
  price:      { ...Typography.headline, fontSize: 20, color: Colors.accentBlue, marginBottom: Spacing[5] },
  desc:       { ...Typography.body, fontSize: 14.5, lineHeight: 23, color: Colors.textMuted, marginBottom: Spacing[6] },
  tags:       { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.stoneSoft },
  tagText:    { ...Typography.caption, color: Colors.textMuted, textTransform: 'capitalize' },
  similarSection: { marginTop: Spacing[6] },
  similarTitle:   { ...Typography.headline, color: Colors.text, paddingHorizontal: 20, marginBottom: Spacing[3] },
  similarScroll:  { paddingHorizontal: 20, gap: Spacing[3], paddingBottom: Spacing[3] },
  similarCard:    { width: 140, borderRadius: Radius.card, overflow: 'hidden', backgroundColor: Colors.surface },
  similarImg:     { width: 140, height: 186, backgroundColor: Colors.stoneSoft },
  similarInfo:    { padding: Spacing[3] },
  similarBrand:   { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing[1] },
  similarName:    { ...Typography.cardTitle, color: Colors.text, marginBottom: Spacing[1] },
  similarPrice:   { ...Typography.cardTitle, color: Colors.accentBlue },
  actions:    { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, backgroundColor: 'rgba(253,252,249,0.95)', borderTopWidth: 1, borderTopColor: Colors.border },
  shopBtn:    { flex: 1, backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  shopBtnText:{ ...Typography.cardTitle, fontSize: 15, color: Colors.text },
  saveBtn:    { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  saveBtnActive: { borderColor: Colors.accent },
});
