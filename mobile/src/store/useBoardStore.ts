import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Board, BoardItem, Product } from '@/types';

interface BoardState {
  boards:         Board[];
  loading:        boolean;
  fetchBoards:    () => Promise<void>;
  createBoard:    (name: string, product: Product) => Promise<Board | null>;
  addToBoard:     (boardId: string, product: Product) => Promise<void>;
  removeFromBoard:(boardId: string, productId: string) => Promise<void>;
  setCover:       (boardId: string, productId: string) => Promise<void>;
  isProductSaved: (productId: string) => boolean;
  getBoardItems:  (boardId: string) => Promise<BoardItem[]>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards:  [],
  loading: false,

  async fetchBoards() {
    set({ loading: true });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false }); return; }
    const { data } = await supabase
      .from('boards')
      .select('*, board_items(product_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    set({ boards: (data ?? []) as Board[], loading: false });
  },

  async createBoard(name, product) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: board, error } = await supabase
      .from('boards')
      .insert({ user_id: user.id, name, cover_product_id: product.id })
      .select()
      .single();
    if (error || !board) return null;
    await supabase.from('board_items').insert({
      board_id: board.id, product_id: product.id, product_data: product,
    });
    await get().fetchBoards();
    return board as Board;
  },

  async addToBoard(boardId, product) {
    await supabase.from('board_items').upsert({
      board_id: boardId, product_id: product.id, product_data: product,
    });
    const board = get().boards.find(b => b.id === boardId);
    if (board && !board.cover_product_id) {
      await supabase.from('boards').update({ cover_product_id: product.id }).eq('id', boardId);
    }
    await get().fetchBoards();
  },

  async removeFromBoard(boardId, productId) {
    await supabase.from('board_items').delete()
      .eq('board_id', boardId).eq('product_id', productId);
    const board = get().boards.find(b => b.id === boardId);
    if (board?.cover_product_id === productId) {
      const { data } = await supabase.from('board_items')
        .select('product_id').eq('board_id', boardId).limit(1);
      await supabase.from('boards')
        .update({ cover_product_id: data?.[0]?.product_id ?? null }).eq('id', boardId);
    }
    await get().fetchBoards();
  },

  async setCover(boardId, productId) {
    await supabase.from('boards').update({ cover_product_id: productId }).eq('id', boardId);
    await get().fetchBoards();
  },

  isProductSaved(productId) {
    return get().boards.some(b =>
      (b.board_items ?? []).some(i => i.product_id === productId),
    );
  },

  async getBoardItems(boardId) {
    const { data } = await supabase
      .from('board_items').select('*').eq('board_id', boardId)
      .order('created_at', { ascending: false });
    return (data ?? []) as BoardItem[];
  },
}));
