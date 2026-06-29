import { create } from 'zustand';

// Backs the desktop-web "glass modal" product view — see ProductModal.tsx
// and lib/navigation.ts's openProduct() for why this exists instead of
// always using router.push: on a wide web viewport, opening a product
// as a real route navigation has no way to show the feed blurred behind
// it (the previous page is just gone). Keeping the feed mounted and
// rendering the product as an overlay on top of it, controlled by this
// store, is what makes the blur-over-real-content effect possible at all.
interface ProductModalState {
  openProductId: string | null;
  open: (productId: string) => void;
  close: () => void;
}

export const useProductModalStore = create<ProductModalState>(set => ({
  openProductId: null,
  open: (productId) => set({ openProductId: productId }),
  close: () => set({ openProductId: null }),
}));
