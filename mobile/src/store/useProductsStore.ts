import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';

interface ProductsState {
  products: Product[];
  notInterestedIds: Set<string>;
  loading: boolean;
  loaded: boolean;
  fetchProducts: () => Promise<void>;
  markNotInterested: (product: Product) => Promise<void>;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Auto-scraped products land in `created_at` order one brand's whole catalog
// at a time, so an unshuffled feed shows 20 items from the same brand in a
// row before moving to the next. Round-robin across brands instead — one
// item per brand per pass, both the brand order and each brand's own item
// order randomized — so the feed actually feels mixed rather than grouped.
function interleaveByBrand(products: Product[]): Product[] {
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.brand_id ?? p.brand;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  for (const group of groups.values()) shuffle(group);
  const brandKeys = shuffle([...groups.keys()]);

  const result: Product[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const key of brandKeys) {
      const next = groups.get(key)!.shift();
      if (next) { result.push(next); added = true; }
    }
  }
  return result;
}

// Catalog now lives in Supabase (`products` table) instead of a static array —
// fetched once into memory here, same as the old static PRODUCTS array, so
// getProducts()/getProductById() below can stay synchronous and every
// existing call site keeps working with minimal changes.
export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  notInterestedIds: new Set(),
  loading: false,
  loaded: false,

  async fetchProducts() {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    const { data: { user } } = await supabase.auth.getUser();

    // Logged-out (the marketing homepage's showcase) has no taste signals to
    // rank against — same plain shuffle as always. Signed-in users get the
    // ranked feed via the rank_products_for_user RPC (see migration 010):
    // semantic similarity to their own behavioral taste vector, plus small
    // onboarding/shop_for/not-interested adjustments, drawn via weighted
    // sampling so nothing is ever fully excluded. PostgREST can't run
    // pgvector's similarity operators directly, which is why this has to be
    // a Postgres function called via .rpc() rather than a plain .select().
    const [productsRes, notInterestedRes] = await Promise.all([
      user
        ? supabase.rpc('rank_products_for_user', { p_user_id: user.id })
        : supabase.from('products').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      user ? supabase.from('not_interested').select('product_id').eq('user_id', user.id) : Promise.resolve({ data: [] as { product_id: string }[] }),
    ]);
    if (productsRes.error) {
      console.error('fetchProducts:', productsRes.error);
      set({ loading: false });
      return;
    }
    const notInterestedIds = new Set((notInterestedRes.data ?? []).map(r => r.product_id));
    const products = user
      ? (productsRes.data ?? []) as Product[] // already ranked server-side, don't reshuffle it
      : interleaveByBrand((productsRes.data ?? []) as Product[]);
    set({ products, notInterestedIds, loading: false, loaded: true });
  },

  // Hides the product from the feed immediately (this session and every
  // future one) and records brand/category alongside it — meant as a
  // negative signal for ranking later, not just a dismissal log.
  async markNotInterested(product) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    set(state => ({ notInterestedIds: new Set(state.notInterestedIds).add(product.id) }));
    await supabase.from('not_interested').upsert({
      user_id: user.id, product_id: product.id, brand: product.brand, category: product.category ?? null,
    });
  },
}));

export function getProducts({ category = 'all', query = '', page = 1, perPage = 30 } = {}) {
  const { products, notInterestedIds } = useProductsStore.getState();
  let list = products.filter(p => !notInterestedIds.has(p.id));
  list = category === 'all' ? list : list.filter(p => p.category === category);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q)
      || p.brand.toLowerCase().includes(q)
      || (p.search_keywords ?? []).some(k => k.includes(q)),
    );
  }
  const start = (page - 1) * perPage;
  return { products: list.slice(start, start + perPage), hasMore: start + perPage < list.length };
}

export function getProductById(id: string): Product | undefined {
  return useProductsStore.getState().products.find(p => p.id === id);
}
