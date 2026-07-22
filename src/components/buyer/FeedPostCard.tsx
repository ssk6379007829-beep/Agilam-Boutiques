import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { BoutiqueLogo } from '@/components/buyer/BoutiqueLogo';
import { ImageZoom } from '@/components/buyer/ImageZoom';
import { useShop, DEFAULT_FILTERS } from '@/state/ShopContext';
import { useCatalog } from '@/state/CatalogContext';
import { shareProduct } from '@/lib/shareProduct';
import { fmt } from '@/data/demo';
import type { PostWithBoutique } from '@/data/posts';

/** "2 mins ago" / "1 hour ago" / "3 Jul" — Instagram-style relative stamps. */
function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));

/**
 * One post in the Inspire feed.
 *
 * Layout follows the design: boutique identity, a swipeable photo strip with a
 * counter, the copy, the call to action, then the action row. Double-tapping the
 * photo likes it, the way people already expect from a feed.
 */
export function FeedPostCard({
  post,
  liked,
  saved,
  onToggleLike,
  onToggleSave,
}: {
  post: PostWithBoutique;
  liked: boolean;
  saved: boolean;
  onToggleLike: () => void;
  onToggleSave: () => void;
}) {
  const navigate = useNavigate();
  const { showToast, setFilters, setQuery, addToCart } = useShop();
  const { productById } = useCatalog();

  const [slide, setSlide] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);

  const images = post.images?.filter(Boolean) ?? [];
  const boutique = post.boutique;
  const product = post.product_id ? productById(post.product_id) : undefined;

  const onStripScroll = () => {
    const el = stripRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setSlide((prev) => (prev === i ? prev : i));
  };

  const goToSlide = (i: number) => {
    const el = stripRef.current;
    if (!el) return;
    setSlide(i);
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  /** Double-tap to like; a single tap opens the photo full screen. */
  const onPhotoTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (!liked) onToggleLike();
      setBurst(true);
      setTimeout(() => setBurst(false), 620);
      return;
    }
    lastTapRef.current = now;
    setTimeout(() => {
      if (lastTapRef.current === now) {
        lastTapRef.current = 0;
        setZoomOpen(true);
      }
    }, 300);
  };

  const openBoutique = () => boutique && navigate(`/buyer/boutique/${boutique.id}`);

  /** Where the call to action lands: a product, else a filtered edit, else the shop. */
  const onCta = () => {
    if (post.product_id) {
      navigate(`/buyer/product/${post.product_id}`);
      return;
    }
    if (post.category) {
      setQuery('');
      setFilters({ ...DEFAULT_FILTERS, cats: [post.category] });
      navigate('/buyer/results');
      return;
    }
    openBoutique();
  };

  const onShare = async () => {
    const result = await shareProduct({
      title: post.title || boutique?.name || 'Agilam',
      price: product ? fmt(product.price) : '',
      url: product
        ? `${window.location.origin}/buyer/product/${product.id}`
        : boutique?.slug
          ? `${window.location.origin}/b/${boutique.slug}`
          : window.location.href,
      image: images[slide] || images[0],
      boutique: boutique?.name,
    });
    if (result === 'copied') showToast('Link copied — paste to share');
    else if (result === 'failed') showToast("Couldn't share this post");
  };

  /** Only offered when the post points at a real, in-stock product. */
  const onAddToBag = () => {
    if (!product) return;
    if (product.stock === 0) {
      showToast('This piece is out of stock');
      return;
    }
    addToCart(product.id);
  };

  const action = (
    label: string,
    icon: string,
    onClick: () => void,
    opts: { on?: boolean; count?: number; onColor?: string } = {},
  ) => (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={opts.on}
      style={css('display:flex;align-items:center;gap:7px;border:none;background:none;padding:6px 2px;cursor:pointer;')}
    >
      <span
        className={`agx-heart${opts.on ? ' agx-heart-on' : ''}`}
        style={css(`font-size:23px;color:${opts.on ? (opts.onColor ?? '#E11D48') : '#5C4650'};`)}
      >
        {icon}
      </span>
      {opts.count != null && (
        <span style={css('font-size:13.5px;font-weight:800;color:#4B3840;')}>{compact(opts.count)}</span>
      )}
    </button>
  );

  return (
    <article style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;overflow:hidden;box-shadow:0 18px 40px -32px rgba(107,20,54,.55);')}>
      {/* ── Boutique identity ── */}
      <div style={css('display:flex;align-items:center;gap:11px;padding:13px 14px;')}>
        <button onClick={openBoutique} aria-label={`Open ${boutique?.name ?? 'boutique'}`} style={css('border:none;background:none;padding:0;cursor:pointer;')}>
          <BoutiqueLogo name={boutique?.name ?? 'Boutique'} src={boutique?.logo_url} size={44} />
        </button>
        <button onClick={openBoutique} style={css('flex:1;min-width:0;border:none;background:none;padding:0;cursor:pointer;text-align:left;')}>
          <span style={css('display:flex;align-items:center;gap:5px;')}>
            <span style={css('font-weight:800;font-size:14.5px;color:#241019;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>
              {boutique?.name ?? 'Boutique'}
            </span>
            {boutique?.verified && (
              <span style={css("font-family:'Material Symbols Outlined';font-size:16px;color:#3A9BE0;flex:none;")}>verified</span>
            )}
          </span>
          <span style={css('display:block;font-size:12px;color:#8A7078;margin-top:1px;')}>
            {timeAgo(post.created_at)}{boutique?.city ? ` · ${boutique.city}` : ''}
          </span>
        </button>
      </div>

      {/* ── Photos ── */}
      {images.length > 0 && (
        <div style={css('position:relative;')}>
          <div
            ref={stripRef}
            onScroll={onStripScroll}
            onClick={onPhotoTap}
            className="agx-scroll"
            style={css('display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;cursor:zoom-in;')}
          >
            {images.map((src, i) => (
              <div
                key={`${post.id}-${i}`}
                style={css('position:relative;flex:0 0 100%;width:100%;aspect-ratio:4/5;scroll-snap-align:center;scroll-snap-stop:always;background:#F4E6EC;')}
              >
                <ImageSlot src={src} placeholder={post.title} alt={`${post.title} — photo ${i + 1}`} className="agx-prod-fill" />
              </div>
            ))}
          </div>

          {images.length > 1 && (
            <>
              <div style={css("position:absolute;right:12px;top:12px;background:rgba(36,16,25,.55);backdrop-filter:blur(6px);color:#fff;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;padding:4px 9px;border-radius:999px;")}>
                {slide + 1}/{images.length}
              </div>
              <div style={css('position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:rgba(36,16,25,.4);backdrop-filter:blur(6px);')}>
                {images.map((_, i) => (
                  <button
                    key={`${post.id}-dot-${i}`}
                    aria-label={`Go to photo ${i + 1}`}
                    onClick={(e) => { e.stopPropagation(); goToSlide(i); }}
                    style={css(`width:${i === slide ? 16 : 6}px;height:6px;padding:0;border:none;border-radius:999px;cursor:pointer;background:${i === slide ? '#fff' : 'rgba(255,255,255,.5)'};transition:width .25s ease;`)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Double-tap feedback */}
          {burst && (
            <span
              className="agx-heart agx-heart-on"
              style={css('position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:96px;color:#fff;pointer-events:none;text-shadow:0 8px 30px rgba(0,0,0,.45);animation:agx-burst .62s cubic-bezier(.2,.7,.2,1);')}
            >
              favorite
            </span>
          )}
        </div>
      )}

      {/* ── Copy + call to action ── */}
      <div style={css('display:flex;align-items:flex-start;gap:14px;padding:14px 16px 4px;flex-wrap:wrap;')}>
        <div style={css('flex:1;min-width:180px;')}>
          {post.title && (
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:18px;line-height:1.2;color:#241019;")}>
              {post.title}
            </div>
          )}
          {post.caption && (
            <div style={css('font-size:13.5px;line-height:1.55;color:#5C4650;margin-top:5px;text-wrap:pretty;')}>{post.caption}</div>
          )}
          {product && (
            <div style={css('display:flex;align-items:center;gap:8px;margin-top:9px;')}>
              <span style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:19px;")}>{fmt(product.price)}</span>
              {product.stock === 0 && (
                <span style={css('font-size:11px;font-weight:800;color:#D6455A;')}>Out of stock</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onCta}
          style={css('flex:none;display:flex;align-items:center;gap:7px;height:44px;padding:0 17px;border:1.5px solid #F0AFC8;background:#fff;color:#B02454;border-radius:14px;font-weight:800;font-size:13.5px;cursor:pointer;')}
        >
          {post.cta_label || 'Shop Collection'}
          <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>arrow_forward</span>
        </button>
      </div>

      {/* ── Actions ── */}
      <div style={css('display:flex;align-items:center;gap:18px;padding:6px 16px 12px;')}>
        {action(liked ? 'Unlike this post' : 'Like this post', 'favorite', onToggleLike, { on: liked, count: post.likes_count })}
        {/* Comments aren't a thing here — a question about a piece goes straight
            to the boutique on chat, which is where it can actually be answered. */}
        {boutique && action('Ask the boutique', 'chat_bubble', () => navigate(`/buyer/chat/${boutique.id}`))}
        {action('Share this post', 'send', () => void onShare())}
        {product && product.stock > 0 && (
          <button
            onClick={onAddToBag}
            style={css('display:flex;align-items:center;gap:6px;height:36px;padding:0 13px;border:none;border-radius:12px;background:#FCE0EC;color:#B02454;font-weight:800;font-size:12.5px;cursor:pointer;')}
          >
            <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>shopping_bag</span>Add to bag
          </button>
        )}
        <div style={css('flex:1;')} />
        <button
          onClick={onToggleSave}
          aria-label={saved ? 'Remove from saved' : 'Save this post'}
          aria-pressed={saved}
          style={css('display:flex;align-items:center;gap:6px;border:none;background:none;padding:6px 2px;cursor:pointer;')}
        >
          <span className={`agx-heart${saved ? ' agx-heart-on' : ''}`} style={css(`font-size:22px;color:${saved ? '#B02454' : '#5C4650'};`)}>
            bookmark
          </span>
          <span style={css(`font-size:13px;font-weight:800;color:${saved ? '#B02454' : '#4B3840'};`)}>{saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {zoomOpen && images.length > 0 && (
        <ImageZoom
          images={images}
          index={slide}
          title={post.title || boutique?.name || 'Photo'}
          onIndexChange={goToSlide}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </article>
  );
}
