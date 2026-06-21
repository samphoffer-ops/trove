import { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProducts, useProductsStore } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { searchProfiles, fetchFollowing } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { MasonryGrid } from '@/components/MasonryGrid';
import { SaveSheet } from '@/components/SaveSheet';
import { Product, Profile } from '@/types';
import { Colors, Radius } from '@/lib/theme';
import { SearchIcon, CloseIcon } from '@/components/Icons';

const PAGE_SIZE = 30;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { isProductSaved } = useBoardStore();
  const { fetchProducts } = useProductsStore();
  const { user } = useAuthStore();
  const [query,      setQuery]      = useState('');
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [people,     setPeople]     = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);
  useEffect(() => {
    if (user) fetchFollowing(user.id).then(list => setFollowingIds(new Set(list.map(p => p.id))));
  }, [user]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setPeople([]); return; }
    searchProfiles(q, user?.id).then(setPeople);
  }, [query, user]);

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

  const { products, hasMore } = getProducts({ query, perPage: visibleCount });
  const hasQuery = query.trim().length > 0;

  function handleScroll(e: any) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) {
      setVisibleCount(c => c + PAGE_SIZE);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.searchBar}>
        <SearchIcon color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Search products, brands, people…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {hasQuery && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <CloseIcon />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={200}>
        {!hasQuery ? (
          <Text style={styles.hint}>Start typing to discover products, brands, or people</Text>
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
                        <Text style={styles.personName}>{person.display_name ?? person.username}</Text>
                        <Text style={styles.personUsername}>@{person.username}</Text>
                      </View>
                      <Pressable style={[styles.followBtn, isFollowing && styles.followBtnActive]} onPress={() => toggleFollow(person.id)}>
                        <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                          {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {products.length === 0 && people.length === 0 ? (
              <Text style={styles.hint}>No results for "{query}"</Text>
            ) : products.length > 0 ? (
              <>
                <MasonryGrid
                  items={products}
                  keyExtractor={p => p.id}
                  horizontalPadding={0}
                  renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={setSaveTarget} />}
                />
                {hasMore && <ActivityIndicator color={Colors.accent} style={{ marginTop: 8, marginBottom: 16 }} />}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <SaveSheet product={saveTarget} onClose={() => setSaveTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, paddingHorizontal: 14,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full,
  },
  input:   { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.text },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  hint:    { fontSize: 15, color: Colors.textMuted, textAlign: 'center', paddingTop: 60 },
  peopleSection: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8 },
  personRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar:      { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  personInfo:  { flex: 1 },
  personName:  { fontSize: 14.5, fontWeight: '600', color: Colors.text },
  personUsername: { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  followBtn:   { borderWidth: 1.5, borderColor: Colors.text, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  followBtnActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  followBtnText:   { fontSize: 13, fontWeight: '600', color: Colors.text },
  followBtnTextActive: { color: Colors.accentLime },
});
