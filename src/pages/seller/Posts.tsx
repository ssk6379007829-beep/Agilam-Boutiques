import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useShop } from '@/state/ShopContext';
import { deletePost, fetchPostsForBoutique, updatePost, type PostWithBoutique } from '@/data/posts';

/**
 * The boutique's Inspire posts — what buyers who follow this shop see in their
 * feed. Publish, hide and delete from here; the composer lives on its own route.
 */
export function Posts() {
  const navigate = useNavigate();
  const { boutique, loading: boutiqueLoading } = useMyBoutique();
  const { showToast } = useShop();

  const [posts, setPosts] = useState<PostWithBoutique[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (boutiqueId: string) => {
    setLoading(true);
    setError(null);
    try {
      setPosts(await fetchPostsForBoutique(boutiqueId));
    } catch (e) {
      setError(
        e instanceof Error && /does not exist|schema cache/i.test(e.message)
          ? 'Posts aren’t set up yet — apply migration 0020 in Supabase.'
          : 'Couldn’t load your posts.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (boutique?.id) void load(boutique.id);
    else if (!boutiqueLoading) setLoading(false);
  }, [boutique?.id, boutiqueLoading, load]);

  const toggleStatus = async (p: PostWithBoutique) => {
    const next = p.status === 'published' ? 'hidden' : 'published';
    setBusy(p.id);
    try {
      await updatePost(p.id, { status: next });
      setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
      showToast(next === 'published' ? 'Post is live' : 'Post hidden from the feed');
    } catch {
      showToast("Couldn't update that post");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: PostWithBoutique) => {
    // Deleting is not recoverable and takes the post out of every buyer's feed.
    if (!window.confirm(`Delete “${p.title || 'this post'}”? This can't be undone.`)) return;
    setBusy(p.id);
    try {
      await deletePost(p.id);
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
      showToast('Post deleted');
    } catch {
      showToast("Couldn't delete that post");
    } finally {
      setBusy(null);
    }
  };

  const newPost = () => navigate('/seller/posts/new');

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:820px;margin:0 auto;')}>
        <div style={css('display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:4px 0 6px;')}>
          <div>
            <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Inspire feed</div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,38px);line-height:1.05;margin-top:4px;")}>Posts</div>
          </div>
          <button
            onClick={newPost}
            style={css('display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 14px 30px -16px rgba(214,51,108,.85);')}
          >
            <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>add_photo_alternate</span>New post
          </button>
        </div>

        <div style={css('display:flex;gap:11px;margin-top:12px;padding:14px 16px;background:#fff;border:1px solid #F2E4EA;border-radius:18px;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:21px;flex:none;")}>auto_awesome</span>
          <div style={css('font-size:12.5px;color:#5C4650;line-height:1.55;')}>
            Posts appear in the Inspire feed of every buyer who follows your boutique. Show a lookbook, a new
            arrival or an offer — and point the button at the piece you want them to buy.
          </div>
        </div>

        {error && (
          <div style={css('display:flex;gap:11px;margin-top:14px;padding:14px 16px;background:#FFF8E8;border:1px solid #F0D8A2;border-radius:16px;color:#7A6450;font-size:13px;line-height:1.5;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#C99A3F;font-size:20px;flex:none;")}>cloud_off</span>
            {error}
          </div>
        )}

        {loading && (
          <div style={css('display:flex;flex-direction:column;gap:12px;margin-top:16px;')}>
            {[0, 1].map((i) => <span key={i} className="agx-shimmer" style={css('height:112px;border-radius:20px;')} />)}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 30px;')}>
            <div style={css('width:80px;height:80px;border-radius:50%;background:linear-gradient(145deg,#FCE0EC,#F7CFDF);display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:36px;color:#B02454;")}>photo_library</span>
            </div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:23px;margin-top:18px;")}>No posts yet</div>
            <div style={css('color:#8A7078;font-size:14px;margin-top:8px;max-width:330px;line-height:1.55;')}>
              Your first post is how followers find out you’ve got something new.
            </div>
            <button onClick={newPost} style={css('margin-top:18px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:14px;padding:13px 22px;font-weight:800;font-size:14px;cursor:pointer;')}>
              Create your first post
            </button>
          </div>
        )}

        <div style={css('display:flex;flex-direction:column;gap:12px;margin-top:16px;')}>
          {posts.map((p) => {
            const live = p.status === 'published';
            return (
              <div key={p.id} style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:14px;box-shadow:0 16px 36px -32px rgba(107,20,54,.55);')}>
                <div style={css('display:flex;gap:13px;')}>
                  <div className="agx-thumb-media" style={css('width:76px;background:#F4E6EC;')}>
                    <ImageSlot src={p.images?.[0]} placeholder={p.title} className="agx-prod-fill" />
                  </div>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;')}>
                      <span style={css(`font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:999px;background:${live ? '#E5F3EC' : '#F1E4EB'};color:${live ? '#2FA36B' : '#8A7078'};`)}>
                        {live ? 'Live' : 'Hidden'}
                      </span>
                      <span style={css('font-size:12px;color:#8A7078;')}>
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span style={css('display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:#B02454;')}>
                        <span className="agx-heart agx-heart-on" style={css('font-size:15px;color:#E11D48;')}>favorite</span>
                        {p.likes_count}
                      </span>
                    </div>
                    <div style={css('font-weight:800;font-size:14.5px;margin-top:6px;line-height:1.25;')}>{p.title || 'Untitled post'}</div>
                    <div style={css('font-size:12.5px;color:#8A7078;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;')}>
                      {p.caption || '—'}
                    </div>
                    <div style={css('font-size:11.5px;color:#B79AA6;margin-top:5px;')}>
                      {p.images?.length ?? 0} photo{(p.images?.length ?? 0) === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>

                <div style={css('display:flex;gap:9px;margin-top:13px;padding-top:12px;border-top:1px solid #F4E6EC;flex-wrap:wrap;')}>
                  <button
                    onClick={() => navigate(`/seller/posts/${p.id}`)}
                    disabled={busy === p.id}
                    style={css('flex:1;min-width:110px;height:40px;border:1.5px solid #F0D8E2;background:#fff;color:#B02454;border-radius:12px;font-weight:800;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;')}
                  >
                    <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>edit</span>Edit
                  </button>
                  <button
                    onClick={() => void toggleStatus(p)}
                    disabled={busy === p.id}
                    style={css(`flex:1;min-width:110px;height:40px;border:none;border-radius:12px;background:#FCE0EC;color:#B02454;font-weight:800;font-size:12.5px;cursor:${busy === p.id ? 'wait' : 'pointer'};display:flex;align-items:center;justify-content:center;gap:6px;`)}
                  >
                    <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>{live ? 'visibility_off' : 'visibility'}</span>
                    {live ? 'Hide' : 'Publish'}
                  </button>
                  <button
                    onClick={() => void remove(p)}
                    disabled={busy === p.id}
                    aria-label="Delete post"
                    style={css('width:40px;height:40px;flex:none;border:1.5px solid #F3D4D9;background:#fff;color:#C0455E;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;')}
                  >
                    <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
