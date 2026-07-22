import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

/**
 * Inspire feed data — boutique posts, likes and saves.
 *
 * Reads are public (published posts from approved boutiques), so an anonymous
 * buyer gets a full feed. Writes split by who's asking: sellers manage their own
 * posts through per-owner RLS, and likes go through the `toggle_post_like` RPC
 * so a guest's tap still moves the shared counter.
 *
 * Requires migration 0020.
 */

export type PostRow = {
  id: string;
  boutique_id: string;
  title: string;
  caption: string;
  images: string[];
  product_id: string | null;
  category: string | null;
  cta_label: string;
  status: 'published' | 'hidden';
  likes_count: number;
  created_at: string;
};

export type PostWithBoutique = PostRow & {
  boutique: { id: string; name: string; city: string; logo_url: string | null; verified: boolean; slug: string | null } | null;
};

const SELECT =
  'id, boutique_id, title, caption, images, product_id, category, cta_label, status, likes_count, created_at,' +
  ' boutique:boutiques(id, name, city, logo_url, verified, slug)';

/** Rows come back with the join typed loosely by supabase-js; narrow once here. */
const shape = (rows: unknown): PostWithBoutique[] => (rows ?? []) as unknown as PostWithBoutique[];

/**
 * The feed for a set of boutiques, newest first.
 *
 * `before` is the `created_at` of the last row already on screen — keyset
 * pagination rather than offset, so new posts arriving mid-scroll can't shift
 * the window and make the buyer see a duplicate or miss one.
 */
export async function fetchFeed(opts: {
  boutiqueIds?: string[];
  limit?: number;
  before?: string;
}): Promise<PostWithBoutique[]> {
  const { boutiqueIds, limit = 8, before } = opts;
  // An explicit empty list means "following nobody" — return nothing rather than
  // silently falling back to every boutique.
  if (boutiqueIds && boutiqueIds.length === 0) return [];

  let q = supabase.from('posts').select(SELECT).eq('status', 'published');
  if (boutiqueIds) q = q.in('boutique_id', boutiqueIds);
  if (before) q = q.lt('created_at', before);

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return shape(data);
}

/** Every post a boutique has, drafts included — the seller's own list. */
export async function fetchPostsForBoutique(boutiqueId: string): Promise<PostWithBoutique[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(SELECT)
    .eq('boutique_id', boutiqueId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return shape(data);
}

export async function fetchPost(id: string): Promise<PostWithBoutique | null> {
  const { data, error } = await supabase.from('posts').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as unknown as PostWithBoutique) ?? null;
}

// ── Seller mutations ────────────────────────────────────────────────────────

export type PostInput = {
  title: string;
  caption: string;
  images: string[];
  product_id: string | null;
  category: string | null;
  cta_label: string;
  status: 'published' | 'hidden';
};

export async function createPost(boutiqueId: string, input: PostInput): Promise<PostRow> {
  const { data, error } = await supabase
    .from('posts')
    .insert({ boutique_id: boutiqueId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as PostRow;
}

export async function updatePost(id: string, patch: Partial<PostInput>): Promise<void> {
  const { error } = await supabase.from('posts').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
}

/** Uploads a post photo to the public `post-images` bucket, returning its URL. */
export async function uploadPostImage(boutiqueId: string, file: File): Promise<string> {
  return uploadImage('post-images', boutiqueId, file, '0020');
}

// ── Buyer interactions ──────────────────────────────────────────────────────

/** Toggle a like and get the authoritative new count back. */
export async function togglePostLike(postId: string, like: boolean): Promise<number> {
  const { data, error } = await supabase.rpc('toggle_post_like', { pid: postId, do_like: like });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export async function dbAddPostSave(buyerId: string, postId: string): Promise<void> {
  const { error } = await supabase
    .from('post_saves')
    .upsert({ buyer_id: buyerId, post_id: postId }, { onConflict: 'post_id,buyer_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function dbRemovePostSave(buyerId: string, postId: string): Promise<void> {
  const { error } = await supabase.from('post_saves').delete().eq('buyer_id', buyerId).eq('post_id', postId);
  if (error) throw error;
}

/**
 * The signed-in buyer's likes and saves, and a merge of whatever they built as a
 * guest on this device. Mirrors `mergeGuestCollections` for the bag/wishlist:
 * union semantics, so nothing is lost by signing in.
 */
export async function loadAndMergeInteractions(
  buyerId: string,
  local: { likes: Record<string, boolean>; saves: Record<string, boolean> },
): Promise<{ likes: Record<string, boolean>; saves: Record<string, boolean> }> {
  const localSaves = Object.keys(local.saves).filter((id) => local.saves[id]);
  if (localSaves.length) {
    await supabase
      .from('post_saves')
      .upsert(localSaves.map((post_id) => ({ buyer_id: buyerId, post_id })), {
        onConflict: 'post_id,buyer_id',
        ignoreDuplicates: true,
      });
  }

  const [likeRes, saveRes] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('buyer_id', buyerId),
    supabase.from('post_saves').select('post_id').eq('buyer_id', buyerId),
  ]);
  if (likeRes.error) throw likeRes.error;
  if (saveRes.error) throw saveRes.error;

  const likes: Record<string, boolean> = {};
  for (const r of likeRes.data ?? []) likes[r.post_id] = true;
  const saves: Record<string, boolean> = {};
  for (const r of saveRes.data ?? []) saves[r.post_id] = true;

  // Guest likes aren't merged: the counter already absorbed them anonymously, so
  // replaying them as rows would count the same tap twice.
  return { likes, saves };
}

/** Live like-count updates while the feed is open. */
export function subscribeToPostCounts(onChange: (postId: string, likes: number) => void) {
  const channel = supabase
    .channel('feed-post-counts')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
      const row = payload.new as { id?: string; likes_count?: number };
      if (row.id && typeof row.likes_count === 'number') onChange(row.id, row.likes_count);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
