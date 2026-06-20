import { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProducts, useProductsStore } from '@/store/useProductsStore';
import { useBoardStore } from '@/store/useBoardStore';
import { ProductCard } from '@/components/ProductCard';
import { MasonryGrid } from '@/components/MasonryGrid';
import { SaveSheet } from '@/components/SaveSheet';
import { Product } from '@/types';
import { Colors, Radius } from '@/lib/theme';
import { SearchIcon, CloseIcon } from '@/components/Icons';

const PAGE_SIZE = 30;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { isProductSaved } = useBoardStore();
  const { fetchProducts } = useProductsStore();
  const [query,      setQuery]      = useState('');
  const [saveTarget, setSaveTarget] = useState<Product | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);

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
          placeholder="Search products, brands…"
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
          <Text style={styles.hint}>Start typing to discover products</Text>
        ) : products.length === 0 ? (
          <Text style={styles.hint}>No results for "{query}"</Text>
        ) : (
          <>
            <MasonryGrid
              items={products}
              keyExtractor={p => p.id}
              horizontalPadding={0}
              renderItem={p => <ProductCard product={p} saved={isProductSaved(p.id)} onSave={setSaveTarget} />}
            />
            {hasMore && <ActivityIndicator color={Colors.accent} style={{ marginTop: 8, marginBottom: 16 }} />}
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
});
