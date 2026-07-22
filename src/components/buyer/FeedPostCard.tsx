import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { BoutiqueLogo } from '@/components/buyer/BoutiqueLogo';
import { useShop } from '@/state/ShopContext';
import { shareProduct } from '@/lib/shareProduct';
import { TONES, fmt } from '@/data/demo';
import type { FeedProduct } from '@/data/feed';

/** "2 mins ago" / "1 hour ago" / "3 Jul" — feed-style relative stamps. */
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
 * One piece in the Inspire feed.
 *
 * The card *is* the listing — the boutique's own photos, title, price and
 * description, with nothing re-entered. It carries exactly one buying action:
 * Add to bag, which becomes a quantity stepper once the piece is in. Anything
 * more (size chart, full description, reviews, zoom) is a tap away on the
 * product page, reachable from the photo, the title or the "View details" link.
 *
 * Where the boutique declared sizes, one has to be chosen before the piece can
 * go in the bag — sending an order without a size just moves the problem to the
 * seller, who then has to chase the buyer on chat.
 */
export function FeedPostCard({
  product,
  liked,
  likes,
  onToggleLike,
}: {
  product: FeedProduct;
  liked: boolean;
  likes: number;
  onToggleLike: () => void;
}) {
  const navigate = useNavigate();
  const { showToast, addToCart, cart, cartQty } = useShop();

  const [slide, setSlide] = useState(0);
  const [pickedSize, setPickedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const boutique = product.boutique;
  // The listing's own gallery: the cover first, then the rest, de-duped.
  const images = [...new Set([product.image_url, ...(product.images ?? [])].filter(Boolean))] as string[];

  const price = Number(product.price);
  const mrp = product.mrp != null ? Number(product.mrp) : null;
  const hasMrp = !!mrp && mrp > price;
  const discountPct = hasMrp ? Math.round((1 - price / (mrp as number)) * 100) : null;

  // Only the sizes the boutique actually listed. When it declared none, there is
  // nothing to choose and the line goes in as free size.
  const sizeOptions = product.sizes ?? [];
  const needsSize = sizeOptions.length > 0;
  const bagLine = cart[product.id];
  const bagQty = bagLine?.qty ?? 0;
  // What the buyer picked here, else the size this piece is already in the bag
  // at — never a size that isn't on sale, and never a silent default.
  const selectedSize =
    (pickedSize && sizeOptions.includes(pickedSize) ? pickedSize : null) ??
    (bagLine && sizeOptions.includes(bagLine.size) ? bagLine.size : null);

  const soldOut = product.stock === 0;
  const lowStock = !soldOut && product.stock <= 5;
  const openProduct = () => navigate(`/buyer/product/${product.id}`);
  const openBoutique = () => boutique && navigate(`/buyer/boutique/${boutique.id}`);

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

  const onShare = async () => {
    const result = await shareProduct({
      title: product.title,
      price: fmt(price),
      url: `${window.location.origin}/buyer/product/${product.id}`,
      image: images[slide] || images[0],
      boutique: boutique?.name,
    });
    if (result === 'copied') showToast('Product details copied — paste to share');
    else if (result === 'failed') showToast("Couldn't share this piece");
  };

  const pickSize = (s: string) => {
    setPickedSize(s);
    setSizeError(false);
  };

  const onAddToBag = () => {
    if (soldOut) {
      showToast('This piece is out of stock');
      return;
    }
    if (needsSize && !selectedSize) {
      setSizeError(true);
      showToast('Please choose a size first');
      return;
    }
    addToCart(product.id, selectedSize ?? 'Free');
  };

  const onIncrease = () => {
    if (bagQty >= product.stock) {
      showToast(`Only ${product.stock} left in stock`);
      return;
    }
    cartQty(product.id, 1);
  };

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
            {timeAgo(product.created_at)}{boutique?.city ? ` · ${boutique.city}` : ''}
          </span>
        </button>
        <span style={css('flex:none;font-size:11px;font-weight:800;color:#B02454;background:#FCE0EC;border-radius:999px;padding:5px 11px;')}>
          {product.category}
        </span>
      </div>

      {/* ── Photos. Tapping opens the full product page — the feed's route into
             detail, so it's instant rather than waiting on a double-tap. ── */}
      <div style={css('position:relative;')}>
        <div
          ref={stripRef}
          onScroll={onStripScroll}
          onClick={openProduct}
          className="agx-scroll"
          style={css('display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;cursor:pointer;')}
        >
          {(images.length ? images : ['']).map((src, i) => (
            <div
              key={`${product.id}-${i}`}
              style={css(`position:relative;flex:0 0 100%;width:100%;aspect-ratio:4/5;scroll-snap-align:center;scroll-snap-stop:always;background:${TONES[product.tone % TONES.length]};`)}
            >
              <ImageSlot src={src || undefined} placeholder={product.title} alt={`${product.title} — photo ${i + 1}`} className="agx-prod-fill" />
            </div>
          ))}
        </div>

        {hasMrp && (
          <div style={css('position:absolute;left:12px;top:12px;background:linear-gradient(135deg,#2FA36B,#1E8455);color:#fff;font-size:11.5px;font-weight:800;padding:6px 11px;border-radius:999px;box-shadow:0 8px 20px -10px rgba(30,132,85,.9);')}>
            {discountPct}% off
          </div>
        )}

        {images.length > 1 && (
          <>
            <div style={css("position:absolute;right:12px;top:12px;background:rgba(36,16,25,.55);backdrop-filter:blur(6px);color:#fff;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;padding:4px 9px;border-radius:999px;")}>
              {slide + 1}/{images.length}
            </div>
            <div style={css('position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:rgba(36,16,25,.4);backdrop-filter:blur(6px);')}>
              {images.map((_, i) => (
                <button
                  key={`${product.id}-dot-${i}`}
                  aria-label={`Go to photo ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); goToSlide(i); }}
                  style={css(`width:${i === slide ? 16 : 6}px;height:6px;padding:0;border:none;border-radius:999px;cursor:pointer;background:${i === slide ? '#fff' : 'rgba(255,255,255,.5)'};transition:width .25s ease;`)}
                />
              ))}
            </div>
          </>
        )}

        {soldOut && (
          <div style={css('position:absolute;inset:0;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;pointer-events:none;')}>
            <span style={css('background:#241019;color:#fff;font-size:12.5px;font-weight:800;padding:8px 16px;border-radius:999px;')}>Sold out</span>
          </div>
        )}
      </div>

      {/* ── Like + share ── */}
      <div style={css('display:flex;align-items:center;gap:14px;padding:11px 16px 4px;')}>
        <button
          onClick={onToggleLike}
          aria-label={liked ? 'Unlike' : 'Like this piece'}
          aria-pressed={liked}
          style={css('display:flex;align-items:center;gap:7px;border:none;background:none;padding:6px 2px;cursor:pointer;')}
        >
          <span className={`agx-heart${liked ? ' agx-heart-on' : ''}`} style={css(`font-size:24px;color:${liked ? '#E11D48' : '#5C4650'};`)}>
            favorite
          </span>
          <span style={css('font-size:13.5px;font-weight:800;color:#4B3840;')}>{compact(likes)}</span>
        </button>

        <button
          onClick={() => void onShare()}
          aria-label="Share this piece"
          style={css('display:flex;align-items:center;border:none;background:none;padding:6px 2px;cursor:pointer;')}
        >
          <span className="agx-heart" style={css('font-size:23px;color:#5C4650;')}>send</span>
        </button>

        <div style={css('flex:1;')} />

        <button
          onClick={openProduct}
          style={css('display:flex;align-items:center;gap:4px;border:none;background:none;padding:6px 2px;cursor:pointer;color:#B02454;font-size:12.5px;font-weight:800;')}
        >
          View details
          <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>chevron_right</span>
        </button>
      </div>

      {/* ── The piece ── */}
      <div style={css('padding:4px 16px 0;')}>
        <button onClick={openProduct} style={css('border:none;background:none;padding:0;cursor:pointer;text-align:left;width:100%;')}>
          <span style={css("display:block;font-family:'Playfair Display',serif;font-weight:700;font-size:19px;line-height:1.2;color:#241019;")}>
            {product.title}
          </span>
        </button>

        <div style={css('display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:7px;')}>
          <span style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:24px;")}>{fmt(price)}</span>
          {hasMrp && <span style={css('text-decoration:line-through;color:#B79AA6;font-size:14px;font-weight:700;')}>{fmt(mrp as number)}</span>}
          <span style={css('display:flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700;color:#5C4650;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:15px;color:#E0B84B;")}>star</span>
            {product.rating}
          </span>
          {lowStock && <span style={css('font-size:11.5px;font-weight:800;color:#C99A3F;')}>Only {product.stock} left</span>}
        </div>

        {product.description && (
          <div style={css('font-size:13.5px;line-height:1.55;color:#5C4650;margin-top:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;')}>
            {product.description}
          </div>
        )}

        {/* Fabric / occasion / colour, straight off the listing — no re-entry. */}
        <div style={css('display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;')}>
          {[product.fabric, product.occasion && `${product.occasion} wear`, product.color].filter(Boolean).map((chip) => (
            <span key={chip as string} style={css('font-size:11.5px;font-weight:700;color:#6B5560;background:#FBF6F2;border:1px solid #F0E2E9;border-radius:9px;padding:5px 10px;')}>
              {chip}
            </span>
          ))}
        </div>
      </div>

      {/* ── Buy, without leaving the feed ── */}
      <div style={css('padding:14px 16px 16px;')}>
        {!soldOut && needsSize && (
          <>
            <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
              <span className="agx-eyebrow" style={css(`font-size:9.5px;color:${sizeError ? '#C0455E' : '#8A7078'};`)}>
                {selectedSize ? `Size · ${selectedSize}` : 'Choose a size'}
              </span>
              <button onClick={openProduct} style={css('border:none;background:none;cursor:pointer;color:#B02454;font-size:11.5px;font-weight:800;display:flex;align-items:center;gap:4px;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:15px;")}>straighten</span>Size guide
              </button>
            </div>
            <div style={css(`display:flex;flex-wrap:wrap;gap:8px;margin-top:9px;padding:${sizeError ? '8px' : '0'};border-radius:14px;border:${sizeError ? '1.5px solid #E9A9B6' : 'none'};background:${sizeError ? '#FDF2F4' : 'transparent'};transition:background .2s ease;`)}>
              {sizeOptions.map((s) => {
                const on = selectedSize === s;
                return (
                  <button
                    key={s}
                    onClick={() => pickSize(s)}
                    style={css(`min-width:46px;height:42px;padding:0 13px;border-radius:12px;border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : '#fff'};color:${on ? '#B02454' : '#4B3840'};font-weight:${on ? 800 : 700};font-size:13.5px;cursor:pointer;`)}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* One buying action. Once the piece is in the bag it becomes a stepper,
            so a second tap adjusts the count instead of silently re-adding. */}
        <div style={css(`margin-top:${!soldOut && needsSize ? '13px' : '0'};`)}>
          {soldOut ? (
            <button
              onClick={openProduct}
              style={css('width:100%;height:52px;border:1.5px solid #F0D8E2;background:#fff;color:#B02454;border-radius:15px;font-weight:800;font-size:14.5px;cursor:pointer;')}
            >
              View details
            </button>
          ) : bagQty === 0 ? (
            <button
              onClick={onAddToBag}
              style={css('width:100%;height:52px;border:none;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);')}
            >
              <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>shopping_bag</span>Add to bag
            </button>
          ) : (
            <div style={css('height:52px;display:flex;align-items:center;gap:6px;padding:6px;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);box-shadow:0 16px 34px -16px rgba(214,51,108,.85);')}>
              <button
                onClick={() => cartQty(product.id, -1)}
                aria-label={bagQty === 1 ? 'Remove from bag' : 'Reduce quantity'}
                style={css('width:40px;height:40px;flex:none;padding:0;border:none;border-radius:12px;background:rgba(255,255,255,.2);cursor:pointer;display:flex;align-items:center;justify-content:center;')}
              >
                <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#fff;")}>{bagQty === 1 ? 'delete' : 'remove'}</span>
              </button>
              <button
                onClick={() => navigate('/buyer/cart')}
                style={css('flex:1;min-width:0;height:100%;padding:0;border:none;background:none;color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;')}
              >
                <span style={css('font-weight:800;font-size:15px;')}>
                  {bagQty} in bag{bagLine?.size && bagLine.size !== 'Free' ? ` · ${bagLine.size}` : ''}
                </span>
                <span className="agx-eyebrow" style={css('font-size:8px;color:rgba(255,255,255,.8);')}>View bag</span>
              </button>
              <button
                onClick={onIncrease}
                aria-label="Increase quantity"
                style={css(`width:40px;height:40px;flex:none;padding:0;border:none;border-radius:12px;background:rgba(255,255,255,.2);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:${bagQty >= product.stock ? '.45' : '1'};`)}
              >
                <span style={css("font-family:'Material Symbols Outlined';font-size:20px;color:#fff;")}>add</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
