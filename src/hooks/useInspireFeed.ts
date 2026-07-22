import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';
import {
  fetchFeed,
  togglePostLike,
  dbAddPostSave,
  dbRemovePostSave,
  loadAndMergeInteractions,
  subscribeToPostCounts,
  type PostWithBoutique,
} from '@/data/posts';
import {
  readLocalPostLikes,
  writeLocalPostLikes,
  readLocalPostSaves,
  writeLocalPostSaves,
} from '@/lib/feedLocal';

const PAGE = 6;
/** How many top-rated boutiques seed the feed for someone following nobody. */
const SUGGESTED_SHOPS = 12;

export type FeedSource = 'following' | 'suggested';

/**
 * The Inspire feed: which posts to show, and the buyer's like/save state.
 *
 * Source of posts depends on the buyer. Follow at least one boutique and the
 * feed is exactly those shops, in the order they posted. Follow nobody and it
 * falls back to the highest-rated boutiques so a first-time buyer opens the tab
 * onto real content rather than an empty screen — flagged as `suggested` so the
 * page can say so and nudge them to follow.
 *
 * Likes and saves are local-first (guests browse anonymously), written through
 * to the account when there is one. See `@/lib/feedLocal`.
 */
export function useInspireFeed() {
  const { follows, showToast } = useShop();
  const { boutiques, loading: catalogLoading } = useCatalog();

  const [posts, setPosts] = useState<PostWithBoutique[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [likes, setLikes] = useState<Record<string, boolean>>(() => readLocalPostLikes());
  const [saves, setSaves] = useState<Record<string, boolean>>(() => readLocalPostSaves());

  const buyerIdRef = useRef<string | null>(null);

  // Which shops feed this buyer. Followed ids are intersected with the live
  // catalogue so a stale local follow (a boutique since removed or unapproved)
  // can't empty the feed.
  const { source, boutiqueIds } = useMemo(() => {
    const followed = boutiques.filter((b) => follows[b.id]).map((b) => b.id);
    if (followed.length > 0) return { source: 'following' as FeedSource, boutiqueIds: followed };
    const popular = [...boutiques]
      .sort((a, b) => b.rating - a.rating || b.followers - a.followers)
      .slice(0, SUGGESTED_SHOPS)
      .map((b) => b.id);
    return { source: 'suggested' as FeedSource, boutiqueIds: popular };
  }, [boutiques, follows]);

  // A stable identity for the id set, so the loader re-runs when the buyer
  // follows or unfollows a shop but not on every unrelated catalogue render.
  const idsKey = boutiqueIds.join(',');

  // First page (and a reload whenever the source set changes).
  useEffect(() => {
    // Nothing to ask for until the catalogue has resolved which shops exist.
    if (catalogLoading && boutiques.length === 0) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchFeed({ boutiqueIds, limit: PAGE })
      .then((rows) => {
        if (!active) return;
        setPosts(rows);
        setExhausted(rows.length < PAGE);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setPosts([]);
        setError(
          e instanceof Error && /relation .*posts.* does not exist|schema cache/i.test(e.message)
            ? 'The feed isn’t set up yet — apply migration 0020 in Supabase.'
            : 'Couldn’t load the feed. Pull to refresh or try again shortly.',
        );
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, catalogLoading]);

  const loadMore = useCallback(async () => {
    if (loadingMore || exhausted || loading || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const before = posts[posts.length - 1].created_at;
      const rows = await fetchFeed({ boutiqueIds, limit: PAGE, before });
      // De-dupe defensively: a post edited mid-scroll can reorder under us.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...rows.filter((r) => !seen.has(r.id))];
      });
      if (rows.length < PAGE) setExhausted(true);
    } catch {
      setExhausted(true);
    } finally {
      setLoadingMore(false);
    }
  }, [posts, boutiqueIds, loadingMore, exhausted, loading]);

  // Pull the account's likes/saves once signed in, merging local saves up.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      buyerIdRef.current = uid;
      if (!uid) return;
      loadAndMergeInteractions(uid, { likes: readLocalPostLikes(), saves: readLocalPostSaves() })
        .then((merged) => {
          if (!active) return;
          // Union with local likes: a guest tap already moved the counter, so the
          // heart must stay filled even though there's no row for it.
          setLikes((local) => ({ ...local, ...merged.likes }));
          setSaves(merged.saves);
        })
        .catch(() => { /* offline — local state still renders */ });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => writeLocalPostLikes(likes), [likes]);
  useEffect(() => writeLocalPostSaves(saves), [saves]);

  // Keep counts honest while the feed is open.
  useEffect(() => subscribeToPostCounts((postId, likesCount) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: likesCount } : p)));
  }), []);

  const toggleLike = useCallback((postId: string) => {
    const next = !likes[postId];
    setLikes((m) => {
      const copy = { ...m };
      if (next) copy[postId] = true;
      else delete copy[postId];
      return copy;
    });
    // Optimistic: realtime reconciles to the authoritative number, and the RPC's
    // return value corrects it directly if realtime isn't connected.
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count + (next ? 1 : -1)) } : p)),
    );
    togglePostLike(postId, next)
      .then((count) => setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: count } : p))))
      .catch(() => {
        // Roll the tap back rather than leaving a heart that didn't register.
        setLikes((m) => {
          const copy = { ...m };
          if (next) delete copy[postId];
          else copy[postId] = true;
          return copy;
        });
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count + (next ? -1 : 1)) } : p)),
        );
        showToast("Couldn't register that — check your connection");
      });
  }, [likes, showToast]);

  const toggleSave = useCallback((postId: string) => {
    const next = !saves[postId];
    setSaves((m) => {
      const copy = { ...m };
      if (next) copy[postId] = true;
      else delete copy[postId];
      return copy;
    });
    const uid = buyerIdRef.current;
    if (uid) {
      (next ? dbAddPostSave(uid, postId) : dbRemovePostSave(uid, postId)).catch(() => {
        showToast("Couldn't sync — saved on this device");
      });
    }
    showToast(next ? 'Saved to your collection' : 'Removed from saved');
  }, [saves, showToast]);

  return {
    posts,
    source,
    loading,
    loadingMore,
    exhausted,
    error,
    loadMore,
    likes,
    saves,
    toggleLike,
    toggleSave,
  };
}
