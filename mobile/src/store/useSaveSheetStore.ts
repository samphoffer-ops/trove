import { create } from 'zustand';
import { Product } from '@/types';

// The product the Save to Board sheet (app/save.tsx) is saving. Route params
// only carry strings, and addToBoard stores the whole Product as
// product_data, so openSaveSheet() parks it here before pushing the route.
interface SaveSheetState {
  product: Product | null;
  setProduct: (product: Product | null) => void;
}

export const useSaveSheetStore = create<SaveSheetState>(set => ({
  product: null,
  setProduct: (product) => set({ product }),
}));
