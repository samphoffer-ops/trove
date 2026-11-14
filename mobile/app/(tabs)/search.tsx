import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchProducts, useProductsStore } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { searchProfiles, fetchFollowing } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { MasonryGrid } from '@/components/MasonryGrid';
import { ShareSheet } from '@/components/ShareSheet';
import { QuickActionsMenu, QuickAction } from '@/components/QuickActionsMenu';
import { GlassHeader, GLASS_HEADER_HEIGHT } from '@/components/GlassHeader';
import { Product, Profile } from '@/types';
import { Colors, Radius, Typography, Spacing, DisplayScaling } from '@/lib/theme';
import * as haptics from '@/lib/haptics';
import { openSaveSheet } from '@/lib/navigation';
import { SearchIcon, CloseIcon, BookmarkIcon, ShareIcon } from '@/components/Icons';

const PAGE_SIZE = 30;
const FIELD_HEIGHT = 44; // Apple's minimum hit target

// The search tab (#63). Same frame as Boards: floating glass header, a
// display title, then the field on the page, not in a dark bar. Results
// come from search_products (migration 039), which searches the whole
// catalog server-side rather than the feed's ranked slice.
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { isProductSaved } = useBoardStore();
  const { notInterestedIds, markNotInterested } = useProductsStore();
  const { user } = useAuthStore();
  const inputRef = useRef<TextInput>(null);
  const [query,      setQuery]      = useState('');
  const [shareTarget, setShareTarget] = useState<Product | null>(null);
  const [quickActions, setQuickActions] = useState<{ product: Product; anchor: { x: number; y: number } } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [people,     setPeople]     = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching,  setSearching]  = useState(false);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);
  useEffect(() => {
    if (user) fetchFollowing(user.id).then(list => setFollowingIds(new Set(list.map(p => p.id))));
  }, [user]);

  // Each effect drops its response once the query has moved on, so a slow
  // answer for "ja" can't land on top of the one for "jacket".
  useEffect(() => {
    const q = query.trim();
    if (!q) { setPeople([]); return; }
    let stale = false;
    searchProfiles(q, user?.id).then(found => { if (!stale) setPeople(found); });
    return () => { stale = true; };
  }, [query, user]);

  // Debounced: a network round trip per settled query.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults([]); setSearching(false); return; }
    let stale = false;
    setSearching(true);
    const timeout = setTimeout(() => {
      searchProducts(q).then(results => {
        if (stale) return;
        setSearchResults(results.filter(p => !notInterestedIds.has(p.id)));
        setSearching(false);
      });
    }, 300);
    return () => { stale = true; clearTimeout(timeout); };
  }, [query, notInterestedIds]);

  async function toggleFollow(personId: string) {
    if (!user) return;
    const isFollowing = followingIds.has(personId);
    setFollowingIds(prev => {
      const next = new Set(prev);
      isFollowing ? next.delete(personId) : next.add(personId);
      return next;
    });
    if (isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', personId);
    else await supabase.from('follows').insert({ follower_id: user.id, following_id: personId });
  }

  const products = searchResults.slice(0, visibleCount);
  const hasMore = visibleCount < searchResults.length;
  const hasQuery = query.trim().length > 0;
  // Content starts below the floating glass header, then scrolls under it.
  const headerInset = insets.top + GLASS_HEADER_HEIGHT;

  function handleQuickActions(product: Product, anchor: { x: number; y: number }) {
    setQuickActions({ product, anchor });
  }

  const quickActionsList: QuickAction[] = quickActions ? [
    {
      key: 'save', label: 'Save',
      icon: (color) => <BookmarkIcon color={color} size={18} />,
      onPress: () => { haptics.saveToBoard(); openSaveSheet(quickActions.product); },
    },
    {
      key: 'share', label: 'Share',
      icon: (color) => <ShareIcon color={color} size={18} />,
      onPress: () => setShareTarget(quickActions.product),
    },
    {
      key: 'remove', label: 'Remove',
      icon: (color) => <CloseIcon color={color} size={14} />,
      onPress: () => { haptics.notForMe(); markNotInterested(quickActions.product); },
    },
  ] : [];

  function handleScroll(e: any) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) {
      setVisibleCount(c => c + PAGE_SIZE);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerInset, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollsToTop={true}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        <View style={styles.masthead}>
          <Text {...DisplayScaling} style={styles.pageLabel} accessibilityRole="header">search</Text>
          <Pressable style={styles.field} onPress={() => inputRef.current?.focus()}>
            <SearchIcon color={Colors.textMuted} size={18} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Brands, pieces, people"
              placeholderTextColor={Colors.textLight}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="never"
              selectionColor={Colors.text}
              accessibilityLabel="Search"
            />
            {hasQuery && (
              <Pressable onPress={() => { setQuery(''); inputRef.current?.focus(); }} hitSlop={12} accessibilityLabel="Clear search">
                <CloseIcon color={Colors.textMuted} size={14} />
              </Pressable>
            )}
          </Pressable>
        </View>

        {!hasQuery ? (
          <Text style={styles.hint}>Search every brand in Trove by name, piece or material. People show up here too.</Text>
        ) : (
          <>
            {people.length > 0 && (
              <View style={styles.peopleSection}>
                {people.map(person => {
                  const isFollowing = followingIds.has(person.id);
                  return (
                    <Pressable key={person.id} style={styles.personRow} onPress={() => router.push(`/user/${person.id}`)}>
                      <View style={styles.avatar}>
                        {person.avatar_url ? (
                          <Image source={{ uri: person.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        ) : (
                          <Text style={styles.avatarText}>{(person.display_name ?? person.username)[0].toUpperCase()}</Text>
                        )}
                      </View>
                      <View style={styles.personInfo}>
                        <Text style={styles.personName} numberOfLines={1}>{person.display_name ?? person.username}</Text>
                        <Text style={styles.personUsername} numberOfLines={1}>@{person.username}</Text>
                      </View>
                      <Pressable style={[styles.followBtn, isFollowing && styles.followBtnActive]} onPress={() => toggleFollow(person.id)} hitSlop={6}>
                        <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                          {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {searching && products.length === 0 ? (
              <ActivityIndicator color={Colors.textLight} style={styles.loading} />
            ) : products.length === 0 && people.length === 0 ? (
              <View style={styles.noResults}>
                <Text {...DisplayScaling} style={styles.noResultsTitle}>Nothing for “{query.trim()}”</Text>
                <Text style={styles.hint}>Try a brand name, or a broader word like “jacket” or “linen”.</Text>
              </View>
            ) : products.length > 0 ? (
              <>
                <MasonryGrid
                  items={products}
                  keyExtractor={p => p.id}
                  itemHeight={p => p.ratio}
                  renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={openSaveSheet} onQuickActions={handleQuickActions} />}
                />
                {hasMore && <ActivityIndicator color={Colors.textLight} style={styles.more} />}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* After the content so it draws on top */}
      <GlassHeader />
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
  root:      { flex: 1, backgroundColor: Colors.bg },
  masthead:  { paddingHorizontal: Spacing.screen, paddingTop: Spacing[4], paddingBottom: Spacing[5], gap: Spacing[5] },
  pageLabel: { ...Typography.displayXl, color: Colors.textMuted },
  field: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing[3],
    height:            FIELD_HEIGHT,
    paddingHorizontal: Spacing[5],
    backgroundColor:   Colors.surface,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       Colors.borderStrong,
    borderRadius:      Radius.full,
  },
  input:     { flex: 1, height: FIELD_HEIGHT, ...Typography.body, lineHeight: undefined, color: Colors.text },
  hint:      { ...Typography.body, color: Colors.textMuted, paddingHorizontal: Spacing.screen, maxWidth: 360 },
  loading:   { marginTop: Spacing[6] },
  more:      { marginTop: Spacing[3], marginBottom: Spacing[5] },
  noResults: { gap: Spacing[4], paddingTop: Spacing[3] },
  noResultsTitle: { ...Typography.display, color: Colors.text, paddingHorizontal: Spacing.screen },
  peopleSection: { marginHorizontal: Spacing.screen, marginBottom: Spacing[5], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderStrong, paddingBottom: Spacing[3] },
  personRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[4], paddingVertical: Spacing[3] },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText:  { ...Typography.headline, color: Colors.surface },
  personInfo:  { flex: 1 },
  personName:  { ...Typography.cardTitle, color: Colors.text },
  personUsername: { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },
  followBtn:   { borderWidth: 1.5, borderColor: Colors.text, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  followBtnActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  followBtnText:   { ...Typography.cardTitle, color: Colors.text },
  followBtnTextActive: { color: Colors.accentLime },
});
