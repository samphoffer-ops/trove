export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  taste_brands: string[];
  taste_styles: string[];
  taste_categories: string[];
  onboarding_completed_at: string | null;
}

export interface Product {
  id: string;
  brand: string;
  name: string;
  price: number;
  image: string;
  ratio: number;
  url: string;
  category?: string;
  styles?: string[];
  description?: string;
}

export interface Board {
  id: string;
  user_id: string;
  name: string;
  cover_product_id: string | null;
  is_public: boolean;
  created_at: string;
  profiles?: Profile;
  board_items?: { product_id: string }[];
  board_collaborators?: BoardCollaborator[];
  isOwner?: boolean;
}

export interface BoardItem {
  id: string;
  board_id: string;
  product_id: string;
  product_data: Product;
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
  read_at: string | null;
  created_at: string;
  profiles?: Profile;
}
