export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  taste_brands: string[];
  taste_styles: string[];
  taste_categories: string[];
  shop_for: string[];
  onboarding_completed_at: string | null;
}

export interface Product {
  id: string;
  brand: string;
  name: string;
  price: number;
  image: string;
  images?: string[];   // additional product photos (scraper populates when available)
  ratio: number;
  url: string;
  category?: string;
  styles?: string[];
  search_keywords?: string[];
  description?: string;
  // Catalog/ingestion metadata — present on rows from the `products` table,
  // absent on nothing now that the static array has moved into Supabase.
  brand_id?: string;
  source?: 'manual' | 'auto_scrape';
  status?: 'active' | 'stale' | 'removed';
}

export interface Brand {
  id: string;
  name: string;
  domain: string;
  status: 'pending_review' | 'approved' | 'rejected';
  platform?: 'shopify' | 'ld_json';
  judge_confidence?: number;
  judge_reasoning?: string;
  matched_categories?: string[];
  matched_styles?: string[];
  audience?: 'mens' | 'womens' | 'unisex';
  approved_by?: string;
  approved_at?: string;
  rejected_until?: string;
  created_at: string;
}

export interface Board {
  id: string;
  user_id: string;
  name: string;
  cover_product_id: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  created_at: string;
  profiles?: Profile;
  board_items?: { product_id: string; product_data?: Product; purchased_at?: string | null }[];
  board_collaborators?: BoardCollaborator[];
  isOwner?: boolean;
}

export interface BoardItem {
  id: string;
  board_id: string;
  product_id: string;
  product_data: Product;
  purchased_at: string | null;
  created_at: string;
}

export interface BoardCollaborator {
  id: string;
  board_id: string;
  user_id: string;
  invited_by: string;
  role: 'editor' | 'viewer';
  created_at: string;
  profiles?: Profile;
}

export interface Share {
  id: string;
  sender_id: string;
  recipient_id: string;
  product_id: string;
  product_data: Product;
  message?: string | null;
  read_at: string | null;
  created_at: string;
  profiles?: Profile;
}
