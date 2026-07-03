import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useProductsStore, getProductById, fetchSimilarProducts } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useProductModalStore } from '@/store/useProductModalStore';
import { supabase } from '@/lib/supabase';
import { SaveSheet } from '@/components/SaveSheet';
import { ShareSheet } from '@/components/ShareSheet';
import { ImageGallery } from '@/components/ImageGallery';
import { ChevronLeftIcon, BookmarkIcon, ShareIcon } from '@/components/Icons';
import { Colors, Radius, Typography, Spacing, Shadows } from '@/lib/theme';
import { Product } from '@/types';
import { getAffiliateUrl } from '@/lib/affiliate';
import { goBack, openProduct } from '@/lib/navigation';

const PLACEHOLDER_DESC = 'A considered piece designed to wear and wear. Crafted with attention to material and fit — built to earn a place in your rotation, not just your cart.';

interface Props {
  productId: string;
  topInset?: number;
  bottomInset?: number;
  // Set when rendered inside the desktop glass modal (ProductModal.tsx)
  onClose?: () => void;
}

export function ProductDetailContent({ productId, topInset = 0, bottomInset = 0, onClose }: Props) {
  const { isProductSaved } = useBoardStore();
  const { user } = useAuthStore();
  const { loaded, fetchProducts } = useProductsStore();
  const [saveTarget,  setSaveTarget]  = useState<Product | null>(null);
  const [shareTarget, setShareTarget] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);

  useEffect(() => { fetchProducts(); }, []);

  const product = getProductById(productId);

  useEffect(() => {
    if (!product) return;
    fetchSimilarProducts(product.id).then(setSimilar);
  }, [product?.id]);

  useEffect(() => {
    if (!user || !product) return;
    supabase.from('product_views').upsert(
      { user_id: user.id, product_id: product.id },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
  }, [user, product?.id]);

  function openProductInPlace(id: string) {
    if (onClose) useProductModalStore.getState().open(id);
    else openProduct(id);
  }

  function goToBrand(brandId: string) {
    onClose?.();
    router.push(`/brand/${brandId}`);
  }

  if (!loaded) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }
  if (!product) return null;

  const saved = isProductSaved(product.id);

  // Build image array: hero first, extras deduplicated
  const galleryImages = [product.image, ...(product.images ?? []).filter(u => u && u !== product.image)];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Hero gallery — full-bleed, paging dots for multiple images */}
        <View style={styles.hero}>
          <ImageGallery images={galleryImages} maxHeight={onClose ? 460 : undefined} />

          {/* Floating nav row over the image */}
          <View style={[styles.floatingRow, { top: topInset + 12 }]}>
            <Pressable style={styles.floatBtn} onPress={() => (onClose ? onClose() : goBack('/(tabs)/feed'))}>
              <ChevronLeftIcon size={20} />
            </Pressable>
            <View style={styles.floatActions}>
              <Pressable style={styles.floatBtn} onPress={() => setShareTarget(product)}>
                <ShareIcon size={18} />
              </Pressable>
              <Pressable style={styles.floatBtn} onPress={() => setSaveTarget(product)}>
                <BookmarkIcon color={saved ? Colors.accent : Colors.text} filled={saved} size={18} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Editorial body */}
        <View style={styles.body}>
          {/* Brand — sky blue label, all-caps, tappable */}
          {product.brand_id ? (
            <Pressable onPress={() => goToBrand(product.brand_id!)}>
              <Text style={styles.brand}>{product.brand}</Text>
            </Pressable>
          ) : (
            <Text style={styles.brand}>{product.brand}</Text>
          )}

          {/* Product name — big, bold, editorial */}
          <Text style={styles.name}>{product.name}</Text>

          {/* Price — prominent but not louder than the name */}
          <Text style={styles.price}>${product.price.toFixed(2)}</Text>

          {/* Description */}
          <Text style={styles.desc}>{product.description ?? PLACEHOLDER_DESC}</Text>

          {/* Style/category tags */}
          {((product.styles?.length ?? 0) > 0 || product.category) && (
            <View style={styles.tags}>
              {product.styles?.map(s => (
                <View key={s} style={styles.tag}>
                  <Text style={styles.tagText}>{s}</Text>
                </View>
              ))}
              {product.category && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{product.category}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Similar products */}
        {similar.length > 0 && (
          <View style={styles.similarSection}>
            <View style={styles.similarHeader}>
              <View style={styles.similarAccentBar} />
              <Text style={styles.similarTitle}>You might also like</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarScroll}>
              {similar.map(p => (
                <Pressable key={p.id} style={styles.similarCard} onPress={() => openProductInPlace(p.id)}>
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

      {/* Sticky CTA bar — coral action button */}
      <View style={[styles.actions, { paddingBottom: bottomInset + 16 }]}>
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  hero: { width: '100%', backgroundColor: Colors.stoneSoft },

  floatingRow: {
    position:      'absolute',
    left:          16,
    right:         16,
    flexDirection: 'row',
    justifyContent:'space-between',
    alignItems:    'center',
  },
  floatActions: { flexDirection: 'row', gap: 10 },
  floatBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: 'rgba(253,252,249,0.90)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  body: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: Spacing[3] },

  brand: {
    ...Typography.label,
    color:        Colors.accentBlue,
    marginBottom: Spacing[3],
  },
  name: {
    fontFamily:    'Mulish_900Black',
    fontSize:      28,
    letterSpacing: -0.7,
    lineHeight:    32,
    color:         Colors.text,
    marginBottom:  Spacing[3],
  },
  price: {
    fontFamily:    'Mulish_800ExtraBold',
    fontSize:      20,
    letterSpacing: -0.3,
    color:         Colors.text,
    marginBottom:  Spacing[5],
  },
  desc: {
    ...Typography.body,
    color:        Colors.textMuted,
    marginBottom: Spacing[6],
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag:  {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  tagText: { ...Typography.caption, color: Colors.textMuted, textTransform: 'capitalize' },

  // Similar section
  similarSection: { marginTop: Spacing[6], marginBottom: Spacing[3] },
  similarHeader:  {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing[3],
    paddingHorizontal: 20,
    marginBottom:   Spacing[4],
  },
  similarAccentBar: {
    width:           3,
    height:          16,
    borderRadius:    2,
    backgroundColor: Colors.accent,
  },
  similarTitle:   { ...Typography.headline, fontSize: 18, color: Colors.text },
  similarScroll:  { paddingHorizontal: 20, gap: Spacing[3], paddingBottom: Spacing[3] },
  similarCard:    {
    width:           132,
    borderRadius:    Radius.card,
    overflow:        'hidden',
    backgroundColor: Colors.stoneSoft,
  },
  similarImg:     { width: 132, height: 176 },
  similarInfo:    { padding: Spacing[3], backgroundColor: Colors.surface },
  similarBrand:   { ...Typography.label, color: Colors.accentBlue, marginBottom: 3 },
  similarName:    { ...Typography.cardTitle, fontSize: 12, color: Colors.text, marginBottom: 3 },
  similarPrice:   { ...Typography.price, fontSize: 12, color: Colors.textMuted },

  // Sticky CTA
  actions: {
    position:         'absolute',
    bottom:           0, left: 0, right: 0,
    flexDirection:    'row',
    gap:              12,
    paddingHorizontal: 20,
    paddingTop:        14,
    backgroundColor:  'rgba(253,252,249,0.97)',
    borderTopWidth:    1,
    borderTopColor:   Colors.border,
  },
  shopBtn: {
    flex:            1,
    backgroundColor: Colors.accentLime,
    borderRadius:    Radius.full,
    paddingVertical: 16,
    alignItems:      'center',
  },
  shopBtnText: { ...Typography.headline, fontSize: 15, color: Colors.text },
  saveBtn: {
    width:  52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnActive: { borderColor: Colors.accent },
});
