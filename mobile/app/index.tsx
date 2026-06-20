import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { Platform, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { useAuthStore } from '@/store/useAuthStore';
import { Colors, Radius } from '@/lib/theme';
import { MarketingLayout } from '@/components/MarketingLayout';
import { PhoneMockup } from '@/components/PhoneMockup';
import { useProductsStore } from '@/store/useProductsStore';

const SNAPSHOT = [
  { label: 'Discover', body: 'A feed that earns your trust.' },
  { label: 'Save',     body: 'Shop with purpose.' },
  { label: 'Share',    body: 'Shopping is better together.' },
];

const FEATURED_BRANDS = ['Every Other Thursday', 'Gardenheir', 'Chamula', 'Orée New York', 'Nécessaire'];

function MarketingHome() {
  const { products, fetchProducts } = useProductsStore();
  useEffect(() => { fetchProducts(); }, []);
  const showcase = products.slice(0, 12);

  return (
    <MarketingLayout>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.tagline}>Shop what finds you.</Text>
          <Text style={styles.headline}>You know what you like.{'\n'}You just can't find it.</Text>
          <Text style={styles.sub}>
            Trove is a curated shopping feed built around your taste — not the noise everyone else is pushing.
          </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={styles.heroCta}>
              <Text style={styles.heroCtaText}>Start discovering</Text>
            </Pressable>
          </Link>
        </View>
        <View style={styles.heroVisual}>
          <PhoneMockup width={240} source={require('../assets/screenshots/feed.png')} />
        </View>
      </View>

      {/* 3-feature snapshot */}
      <View style={styles.snapshotRow}>
        {SNAPSHOT.map(item => (
          <View key={item.label} style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>{item.label}</Text>
            <Text style={styles.snapshotBody}>{item.body}</Text>
          </View>
        ))}
      </View>
      <Link href="/features" style={styles.seeHow}>See how it works →</Link>

      {/* Real brand strip — honest legitimacy, not fabricated social proof */}
      <View style={styles.brandStrip}>
        <Text style={styles.brandStripLabel}>Quality brands, already on Trove</Text>
        <View style={styles.brandStripRow}>
          {FEATURED_BRANDS.map(brand => (
            <Text key={brand} style={styles.brandStripName}>{brand}</Text>
          ))}
        </View>
      </View>

      {/* Feed visual — real curated products */}
      <View style={styles.feedSection}>
        <Text style={styles.feedHeadline}>Your taste, in good company.</Text>
        <View style={styles.feedGrid}>
          {showcase.map(p => (
            <View key={p.id} style={styles.feedCard}>
              <Image source={{ uri: p.image }} style={styles.feedImg} contentFit="cover" />
              <Text style={styles.feedBrand}>{p.brand}</Text>
              <Text style={styles.feedName} numberOfLines={1}>{p.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Second CTA */}
      <View style={styles.bottomCta}>
        <Text style={styles.bottomCtaHeadline}>Your next favorite thing is already out there.</Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable style={styles.heroCtaCentered}>
            <Text style={styles.heroCtaText}>Start discovering</Text>
          </Pressable>
        </Link>
      </View>
    </MarketingLayout>
  );
}

export default function Index() {
  const { session, loading, profile, profileLoading } = useAuthStore();

  if (loading || (session && profileLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  // Logged-out web visitors land on the marketing site. The native app (already
  // installed from the App Store) skips straight to sign-in — the App Store
  // listing does the "convince them" job there instead.
  if (!session) {
    if (Platform.OS === 'web') return <MarketingHome />;
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!profile?.onboarding_completed_at) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/feed" />;
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    gap: 40, paddingTop: 56, paddingBottom: 64,
  },
  heroCopy: { flex: 1, minWidth: 320, gap: 16 },
  tagline:  { fontSize: 14, fontWeight: '700', color: Colors.accent, textTransform: 'uppercase', letterSpacing: 1 },
  headline: { fontSize: 44, fontWeight: '800', color: Colors.text, letterSpacing: -1, lineHeight: 50 },
  sub:      { fontSize: 17, color: Colors.textMuted, lineHeight: 26, maxWidth: 460 },
  heroCta:  { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingHorizontal: 28, paddingVertical: 16, alignSelf: 'flex-start', marginTop: 8 },
  heroCtaCentered: { backgroundColor: Colors.accentLime, borderRadius: Radius.full, paddingHorizontal: 28, paddingVertical: 16, alignSelf: 'center', marginTop: 8 },
  heroCtaText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  heroVisual: { flex: 1, minWidth: 240, alignItems: 'center' },

  snapshotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 40 },
  snapshotCard: { flex: 1, minWidth: 200, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 22, borderWidth: 1, borderColor: Colors.border },
  snapshotLabel: { fontSize: 13, fontWeight: '800', color: Colors.accent, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  snapshotBody: { fontSize: 16, fontWeight: '600', color: Colors.text, lineHeight: 22 },
  seeHow: { fontSize: 14.5, fontWeight: '700', color: Colors.text, textDecorationLine: 'none' } as any,

  brandStrip: { paddingVertical: 40, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 16 },
  brandStripLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 18 },
  brandStripRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  brandStripName: { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },

  feedSection: { paddingTop: 64, paddingBottom: 32 },
  feedHeadline: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 24 },
  feedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  feedCard: { width: 160 },
  feedImg:  { width: 160, height: 200, borderRadius: Radius.md, backgroundColor: Colors.stoneSoft, marginBottom: 8 },
  feedBrand:{ fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: Colors.textMuted },
  feedName: { fontSize: 13, fontWeight: '600', color: Colors.text, marginTop: 2 },

  bottomCta: { alignItems: 'center', textAlign: 'center', paddingVertical: 72, gap: 20 } as any,
  bottomCtaHeadline: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center', maxWidth: 480, letterSpacing: -0.4 },
});
