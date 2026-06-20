import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';

interface ProductsState {
  products: Product[];
  loading: boolean;
  loaded: boolean;
  fetchProducts: () => Promise<void>;
}

// Catalog now lives in Supabase (`products` table) instead of a static array —
// fetched once into memory here, same as the old static PRODUCTS array, so
// getProducts()/getProductById() below can stay synchronous and every
// existing call site keeps working with minimal changes.
export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  loading: false,
  loaded: false,

  async fetchProducts() {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchProducts:', error);
      set({ loading: false });
      return;
    }
    set({ products: (data ?? []) as Product[], loading: false, loaded: true });
  },
}));

export function getProducts({ category = 'all', query = '', page = 1, perPage = 30 } = {}) {
  const { products } = useProductsStore.getState();
  let list = category === 'all' ? products : products.filter(p => p.category === category);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q),
    );
  }
  const start = (page - 1) * perPage;
  return { products: list.slice(start, start + perPage), hasMore: start + perPage < list.length };
}

export function getProductById(id: string): Product | undefined {
  return useProductsStore.getState().products.find(p => p.id === id);
}
