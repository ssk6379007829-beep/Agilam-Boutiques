export type Role = 'buyer' | 'seller' | 'admin';
/**
 * Where a boutique sits in the seller lifecycle (migration 0021).
 *
 * `draft`             — created, still working through the 7-step setup wizard.
 * `pending`           — submitted, waiting on an admin.
 * `changes_requested` — admin sent back a correction list (`review_note`).
 * `approved`          — live to buyers.
 * `rejected`          — turned down, with the reason in `review_note`.
 */
export type BoutiqueStatus = 'draft' | 'pending' | 'changes_requested' | 'approved' | 'rejected';
/**
 * Fulfilment state. `rejected` is the seller turning the order down; `cancelled`
 * is the buyer walking away from a COD order before dispatch (migration 0022) —
 * they read differently to both sides and report differently.
 */
export type OrderStatus = 'pending' | 'accepted' | 'shipped' | 'delivered' | 'rejected' | 'cancelled';

/**
 * Settlement state, tracked separately from fulfilment because the two move
 * independently: a prepaid order is `paid` the moment it is written, while a
 * COD order stays `pending` until the seller confirms the cash arrived.
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
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
          slug: string | null;
          city: string;
          area: string;
          description: string;
          tone: number;
          cover_url: string | null;
          logo_url: string | null;
          phone: string | null;
          instagram: string | null;
          established_year: number | null;
          verified: boolean;
          status: BoutiqueStatus;
          featured: boolean;
          rating: number;
          reviews_count: number;
          followers_count: number;
          positive_rating: number;
          created_at: string;
          // ── Seller setup wizard (migration 0021) ──────────────────────────
          owner_name: string;
          whatsapp: string | null;
          email: string | null;
          address_line: string;
          district: string;
          state: string;
          pincode: string;
          map_url: string | null;
          category: string;
          years_in_business: number | null;
          open_time: string;
          close_time: string;
          working_days: string[];
          delivery_available: boolean;
          delivery_areas: string;
          delivery_charge: number;
          cod_enabled: boolean;
          online_payment_enabled: boolean;
          onboarding_step: number;
          onboarding_complete: boolean;
          submitted_at: string | null;
          reviewed_at: string | null;
          notify_orders: boolean;
          notify_messages: boolean;
          notify_promotions: boolean;
          /**
           * Withheld from anon/authenticated by 0021's column-level SELECT
           * grants: writable by the owner, but only readable through the
           * `boutique_private` function. Never add these to BOUTIQUE_COLUMNS.
           */
          gst_number: string | null;
          business_reg_number: string | null;
          bank_account_name: string | null;
          bank_account_number: string | null;
          bank_ifsc: string | null;
          upi_id: string | null;
          review_note: string | null;
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
          description: string;
          mrp: number | null;
          sizes: string[];
          wash_care: string;
          images: string[];
          /** Public hearts on the Inspire feed card (migration 0020). */
          likes_count: number;
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
      cart_items: {
        Row: { buyer_id: string; product_id: string; qty: number; size: string; updated_at: string };
        Insert: { buyer_id: string; product_id: string; qty?: number; size?: string; updated_at?: string };
        Update: Partial<{ qty: number; size: string; updated_at: string }>;
        Relationships: [];
      };
      boutique_followers: {
        Row: { buyer_id: string; boutique_id: string; created_at: string };
        Insert: { buyer_id: string; boutique_id: string };
        Update: Partial<{ buyer_id: string; boutique_id: string }>;
        Relationships: [];
      };
      // ── Inspire feed (migration 0020) ──────────────────────────────────
      // The feed is the catalogue, so the only new table is the public like.
      // Saving a piece is the wishlist above.
      product_likes: {
        Row: { product_id: string; buyer_id: string; created_at: string };
        Insert: { product_id: string; buyer_id: string };
        Update: Partial<{ product_id: string; buyer_id: string }>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          boutique_id: string;
          buyer_id: string;
          rating: number;
          body: string;
          author_name: string | null;
          verified_purchase: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['reviews']['Row']> & {
          product_id: string;
          boutique_id: string;
          buyer_id: string;
          rating: number;
        };
        Update: Partial<Database['public']['Tables']['reviews']['Row']>;
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
          // ── Cash on Delivery (migration 0022) ────────────────────────────
          payment_status: PaymentStatus;
          paid_at: string | null;
          /** Handling fee charged on this delivery; 0 on prepaid orders. */
          cod_fee: number;
          /**
           * Delivery fee on this order. A cart-level charge, so on a
           * multi-boutique checkout it sits on the first order only —
           * total + shipping_fee + cod_fee summed across the batch is what the
           * buyer was quoted.
           */
          shipping_fee: number;
          cancelled_at: string | null;
          cancel_reason: string | null;
          payment_method: string | null;
          payment_id: string | null;
          channel: 'online' | 'offline';
          guest_name: string | null;
          guest_phone: string | null;
          guest_city: string | null;
          guest_address: string | null;
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
      toggle_product_like: {
        Args: { pid: string; do_like: boolean };
        Returns: number;
      };
      create_offline_sale: {
        Args: {
          p_boutique_id: string;
          p_buyer_name: string;
          p_buyer_phone: string;
          p_items: { product_id: string | null; title: string; price: number; qty: number }[];
          p_discount?: number;
          p_payment_method?: string;
        };
        Returns: { id: string; order_number: string; total: number; created_at: string }[];
      };
      /**
       * Buyer-initiated cancellation of an un-dispatched, uncollected COD
       * order (migration 0022). Authorises on order number + the phone captured
       * at checkout, so a guest with no account can still cancel; releases the
       * reserved stock in the same transaction.
       */
      cancel_cod_order: {
        Args: { p_order_number: string; p_phone: string; p_reason?: string | null };
        Returns: { id: string; status: string }[];
      };
      /**
       * The boutique columns 0021 withholds from the public API. SECURITY
       * DEFINER, and answers only for the boutique's owner or an admin — so it
       * returns an empty set rather than erroring for anyone else.
       */
      boutique_private: {
        Args: { bid: string };
        Returns: {
          gst_number: string | null;
          business_reg_number: string | null;
          bank_account_name: string | null;
          bank_account_number: string | null;
          bank_ifsc: string | null;
          upi_id: string | null;
          review_note: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
