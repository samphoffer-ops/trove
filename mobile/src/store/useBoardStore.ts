import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Board, BoardItem, Product } from '@/types';

// board_collaborators has two FKs to profiles (invited_by, user_id) — the
// embed must be disambiguated or PostgREST errors (PGRST201) on every query.
const BOARD_SELECT = '*, board_items(product_id, product_data, purchased_at), board_collaborators(*, profiles!board_collaborators_user_id_fkey(*))';

interface BoardState {
  boards:         Board[];
  loading:        boolean;
  fetchBoards:    () => Promise<void>;
  fetchBoardById: (boardId: string) => Promise<Board | null>;
  createBoard:    (name: string, product: Product) => Promise<Board | null>;
  addToBoard:     (boardId: string, product: Product) => Promise<void>;
  removeFromBoard:(boardId: string, productId: string) => Promise<void>;
  setCover:       (boardId: string, productId: string) => Promise<void>;
  setCoverImage:  (boardId: string, imageUrl: string) => Promise<void>;
  markPurchased:   (boardId: string, productId: string) => Promise<void>;
  unmarkPurchased: (boardId: string, productId: string) => Promise<void>;
  isProductSaved: (productId: string) => boolean;
  getBoardItems:  (boardId: string) => Promise<BoardItem[]>;
  inviteCollaborator: (boardId: string, userId: string) => Promise<void>;
  removeCollaborator: (boardId: string, userId: string) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards:  [],
  loading: false,

  async fetchBoards() {
    set({ loading: true });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false }); return; }

    const [owned, collaborating] = await Promise.all([
      supabase.from('boards').select(BOARD_SELECT).eq('user_id', user.id),
      supabase
        .from('board_collaborators')
        .select(`boards(${BOARD_SELECT})`)
        .eq('user_id', user.id),
    ]);
    if (owned.error) console.error('fetchBoards (owned):', owned.error);
    if (collaborating.error) console.error('fetchBoards (collaborating):', collaborating.error);

    const ownedBoards = ((owned.data ?? []) as Board[]).map(b => ({ ...b, isOwner: true }));
    const sharedBoards = ((collaborating.data ?? []) as unknown as { boards: Board }[])
      .map(r => r.boards)
      .filter(Boolean)
      .map(b => ({ ...b, isOwner: false }));

    const boards = [...ownedBoards, ...sharedBoards]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    set({ boards, loading: false });
  },

  async fetchBoardById(boardId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('boards').select(BOARD_SELECT).eq('id', boardId).single();
    if (!data) return null;
    return { ...(data as Board), isOwner: data.user_id === user?.id };
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

  async setCoverImage(boardId, imageUrl) {
    await supabase.from('boards').update({ cover_image_url: imageUrl }).eq('id', boardId);
    await get().fetchBoards();
  },

  async markPurchased(boardId, productId) {
    await supabase.from('board_items').update({ purchased_at: new Date().toISOString() })
      .eq('board_id', boardId).eq('product_id', productId);
    await get().fetchBoards();
  },

  async unmarkPurchased(boardId, productId) {
    await supabase.from('board_items').update({ purchased_at: null })
      .eq('board_id', boardId).eq('product_id', productId);
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

  async inviteCollaborator(boardId, userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('board_collaborators').insert({
      board_id: boardId, user_id: userId, invited_by: user.id,
    });
    await get().fetchBoards();
  },

  async removeCollaborator(boardId, userId) {
    await supabase.from('board_collaborators').delete()
      .eq('board_id', boardId).eq('user_id', userId);
    await get().fetchBoards();
  },
}));
