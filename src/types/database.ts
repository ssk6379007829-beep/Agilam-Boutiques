export type Role = 'buyer' | 'seller' | 'admin';
export type BoutiqueStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'rejected';
export type ProductStatus = 'pending' | 'active' | 'hidden' | 'rejected';
export type AccountStatus = 'active' | 'blocked';
export type SubPlan = 'boutique' | 'featured';
export type SubStatus = 'active' | 'due' | 'expired';
export type AdStatus = 'live' | 'paused' | 'draft';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Role;
          full_name: string;
          phone: string | null;
          email: string | null;
          city: string | null;
          address: string | null;
          status: AccountStatus;
          deleted_at: string | null;
          updated_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      boutiques: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          city: string;
          description: string;
          tone: number;
          cover_url: string | null;
          verified: boolean;
          status: BoutiqueStatus;
          featured: boolean;
          rating: number;
          reviews_count: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['boutiques']['Row']> & { owner_id: string; name: string };
        Update: Partial<Database['public']['Tables']['boutiques']['Row']>;
        Relationships: [];
      };
      products: {
        Row: {
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
          status: ProductStatus;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['products']['Row']> & { boutique_id: string; title: string };
        Update: Partial<Database['public']['Tables']['products']['Row']>;
        Relationships: [];
      };
      wishlist: {
        Row: { buyer_id: string; product_id: string; created_at: string };
        Insert: { buyer_id: string; product_id: string };
        Update: Partial<{ buyer_id: string; product_id: string }>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          buyer_id: string;
          boutique_id: string;
          status: OrderStatus;
          total: number;
          refunded: boolean;
          refunded_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['orders']['Row']> & { order_number: string; buyer_id: string; boutique_id: string };
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
        Relationships: [];
      };
      order_items: {
        Row: { id: string; order_id: string; product_id: string | null; title: string; price: number; qty: number; size: string | null; color: string | null };
        Insert: Partial<Database['public']['Tables']['order_items']['Row']> & { order_id: string; title: string };
        Update: Partial<Database['public']['Tables']['order_items']['Row']>;
        Relationships: [];
      };
      conversations: {
        Row: { id: string; buyer_id: string; boutique_id: string; created_at: string };
        Insert: { buyer_id: string; boutique_id: string };
        Update: Partial<{ buyer_id: string; boutique_id: string }>;
        Relationships: [];
      };
      messages: {
        Row: { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
        Insert: { conversation_id: string; sender_id: string; body: string };
        Update: Partial<{ body: string }>;
        Relationships: [];
      };
      notifications: {
        Row: { id: string; profile_id: string; type: string; title: string; body: string; read: boolean; created_at: string };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & { profile_id: string; title: string };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
        Relationships: [];
      };
      subscriptions: {
        Row: { id: string; boutique_id: string; plan: SubPlan; status: SubStatus; price: number; renewal_date: string | null; created_at: string };
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']> & { boutique_id: string };
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>;
        Relationships: [];
      };
      admin_activity_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_name: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          meta: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['admin_activity_log']['Row']>;
        Update: never;
        Relationships: [];
      };
      ads: {
        Row: { id: string; title: string; placement: string; status: AdStatus; impressions: number; clicks: number; created_at: string };
        Insert: Partial<Database['public']['Tables']['ads']['Row']> & { title: string };
        Update: Partial<Database['public']['Tables']['ads']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      toggle_boutique_follow: {
        Args: { bid: string; do_follow: boolean };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
