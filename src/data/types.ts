export interface ProductWithBoutique {
  id: string;
  boutique_id: string;
  title: string;
  category: string;
  price: number;
  stock: number;
  fabric: string | null;
  color: string | null;
  occasion: string | null;
  image_url: string | null;
  tone: number;
  featured: boolean;
  rating: number;
  reviews_count: number;
  created_at: string;
  boutique: { name: string; city: string; tone: number } | null;
}

export interface BoutiqueRow {
  id: string;
  owner_id: string;
  name: string;
  city: string;
  description: string;
  tone: number;
  cover_url: string | null;
  verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  rating: number;
  reviews_count: number;
  created_at: string;
}

export interface OrderWithDetails {
  id: string;
  order_number: string;
  buyer_id: string | null;
  boutique_id: string;
  status: 'pending' | 'shipped' | 'delivered' | 'rejected';
  total: number;
  created_at: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_city: string | null;
  buyer: { full_name: string; phone: string | null; city: string | null } | null;
  boutique: { name: string; tone: number } | null;
  items: { id: string; title: string; price: number; qty: number; size: string | null; color: string | null }[];
}

export interface ConversationWithPeer {
  id: string;
  buyer_id: string;
  boutique_id: string;
  created_at: string;
  buyer_name: string;
  boutique_name: string;
  boutique_tone: number;
  last_message: string;
  last_message_at: string | null;
  unread: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}
