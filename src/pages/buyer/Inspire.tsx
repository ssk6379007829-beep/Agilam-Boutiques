import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { FeedPostCard } from '@/components/buyer/FeedPostCard';
import { BoutiqueLogo } from '@/components/buyer/BoutiqueLogo';
import { useInspireFeed } from '@/hooks/useInspireFeed';
import { useShop } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';

/**
 * Inspire — a scrolling feed of posts from the boutiques the buyer follows.
 *
 * The feed is the whole screen: posts load a page at a time and the next page is
 * fetched as the sentinel at the bottom comes into view, so the buyer never taps
 * "load more". Following nobody falls back to the highest-rated shops, clearly
 * labelled as suggestions, with a rail to start following.
 */
export function Inspire() {
  const navigate = useNavigate();
  const { posts, source, loading, loadingMore, exhausted, error, loadMore, likes, saves, toggleLike, toggleSave } =
    useInspireFeed();
  const { follows, toggleFollow, showToast } = useShop();
  const { boutiques } = useCatalog();

  // Infinite scroll. An IntersectionObserver on a sentinel below the last post
  // beats a scroll listener: no per-frame work, and it keeps firing correctly
  // when the feed is inside a scroll container rather than the window.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || exhausted) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, exhausted]);

  /** Shops to offer someone who follows nobody yet. */
  const suggestions = [...boutiques]
    .sort((a, b) => b.rating - a.rating || b.followers - a.followers)
    .slice(0, 10);

  const onFollow = (id: string, name: string) => {
    const next = toggleFollow(id);
    showToast(next ? `Following ${name}` : `Unfollowed ${name}`);
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div className="agx-feed">
        {/* ── Header ── */}
        <div style={css('text-align:center;padding:2px 0 0;')}>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,34px);line-height:1.1;")}>
            Inspire <span style={css('font-style:italic;color:#B02454;')}>✦</span>
          </div>
          <div style={css('color:#8A7078;font-size:13.5px;margin-top:4px;')}>
            {source === 'following' ? 'Fresh from the boutiques you follow' : 'Discover styles. Get inspired.'}
          </div>
        </div>

        {/* ── Follow prompt + rail, when the feed is only suggestions ── */}
        {source === 'suggested' && !loading && (
          <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;padding:16px;box-shadow:0 18px 40px -34px rgba(107,20,54,.55);')}>
            <div style={css('display:flex;align-items:flex-start;gap:12px;')}>
              <span style={css('width:40px;height:40px;flex:none;border-radius:12px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:22px;")}>storefront</span>
              </span>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css('font-weight:800;font-size:14.5px;color:#241019;')}>Make this feed yours</div>
                <div style={css('font-size:12.5px;color:#8A7078;margin-top:2px;line-height:1.5;')}>
                  You’re seeing popular boutiques. Follow a few and Inspire shows only their new drops.
                </div>
              </div>
            </div>

            <div className="agx-scroll" style={css('display:flex;gap:12px;overflow-x:auto;margin-top:14px;padding-bottom:2px;')}>
              {suggestions.map((b) => (
                <div key={b.id} style={css('flex:none;width:104px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;')}>
                  <button onClick={() => navigate(`/buyer/boutique/${b.id}`)} aria-label={`Open ${b.name}`} style={css('border:none;background:none;padding:0;cursor:pointer;')}>
                    <BoutiqueLogo name={b.name} src={b.logo || b.image} size={62} />
                  </button>
                  <span style={css('font-size:12px;font-weight:700;color:#3F2E36;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;')}>
                    {b.name}
                  </span>
                  <button
                    onClick={() => onFollow(b.id, b.name)}
                    style={css(`width:100%;height:30px;border-radius:10px;font-size:11.5px;font-weight:800;cursor:pointer;border:1px solid ${follows[b.id] ? '#F0D8E2' : 'transparent'};background:${follows[b.id] ? '#fff' : 'linear-gradient(140deg,#E14A7E,#B02454 70%,#8E1C44)'};color:${follows[b.id] ? '#B02454' : '#fff'};`)}
                  >
                    {follows[b.id] ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Feed ── */}
        {loading && (
          <div style={css('display:flex;flex-direction:column;gap:18px;')}>
            {[0, 1].map((i) => (
              <div key={i} style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;overflow:hidden;')}>
                <div style={css('display:flex;align-items:center;gap:11px;padding:13px 14px;')}>
                  <span className="agx-shimmer" style={css('width:44px;height:44px;border-radius:50%;')} />
                  <span style={css('flex:1;')}>
                    <span className="agx-shimmer" style={css('display:block;width:44%;height:12px;border-radius:6px;')} />
                    <span className="agx-shimmer" style={css('display:block;width:28%;height:10px;border-radius:5px;margin-top:7px;')} />
                  </span>
                </div>
                <span className="agx-shimmer" style={css('display:block;width:100%;aspect-ratio:4/5;')} />
                <div style={css('padding:14px 16px 18px;')}>
                  <span className="agx-shimmer" style={css('display:block;width:60%;height:14px;border-radius:7px;')} />
                  <span className="agx-shimmer" style={css('display:block;width:80%;height:11px;border-radius:6px;margin-top:9px;')} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={css('display:flex;gap:12px;padding:16px;background:#FFF8E8;border:1px solid #F0D8A2;border-radius:18px;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#C99A3F;font-size:22px;flex:none;")}>cloud_off</span>
            <div style={css('font-size:13px;color:#7A6450;line-height:1.55;')}>{error}</div>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 30px;')}>
            <div style={css('width:82px;height:82px;border-radius:50%;background:linear-gradient(145deg,#FCE0EC,#F7CFDF);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 2px 3px rgba(255,255,255,.7),0 12px 26px -12px rgba(214,51,108,.55);')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:38px;color:#B02454;")}>auto_awesome</span>
            </div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;margin-top:18px;")}>Nothing posted yet</div>
            <div style={css('color:#8A7078;font-size:14px;margin-top:8px;max-width:330px;line-height:1.55;')}>
              {source === 'following'
                ? 'The boutiques you follow haven’t posted yet. Follow a few more and their new drops land here.'
                : 'Boutiques are just getting started. Check back soon for lookbooks and new arrivals.'}
            </div>
            <button
              onClick={() => navigate('/buyer/boutiques')}
              style={css('margin-top:20px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:14px;padding:13px 24px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.8);')}
            >
              Browse boutiques
            </button>
          </div>
        )}

        {posts.map((p) => (
          <FeedPostCard
            key={p.id}
            post={p}
            liked={!!likes[p.id]}
            saved={!!saves[p.id]}
            onToggleLike={() => toggleLike(p.id)}
            onToggleSave={() => toggleSave(p.id)}
          />
        ))}

        {/* Infinite-scroll trigger. Sits below the last post so the next page is
            already loading by the time the buyer reaches the bottom. */}
        <div ref={sentinelRef} style={css('height:1px;')} />

        {loadingMore && (
          <div style={css('display:flex;align-items:center;justify-content:center;gap:9px;padding:14px;color:#B79AA6;font-size:13px;font-weight:700;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>sync</span>Loading more…
          </div>
        )}

        {!loading && exhausted && posts.length > 0 && (
          <div style={css('text-align:center;padding:18px 20px 6px;color:#B79AA6;font-size:12.5px;font-weight:700;')}>
            You’re all caught up ✦
          </div>
        )}
      </div>
    </div>
  );
}
