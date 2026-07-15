import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchProduct } from '@/data/products';
import { fetchWishlistIds, toggleWishlist } from '@/data/wishlist';
import { getOrCreateConversation } from '@/data/chat';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { fmtInr, toneHex } from '@/lib/tokens';
import { useToast } from '@/components/ui/Toast';

const SIZES = ['S', 'M', 'L'];
const COLORS = ['#E7719F', '#9B7FC7', '#5FA37E'];

export function ProductDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const { data: product } = useAsync(() => fetchProduct(id), [id]);
  const [wished, setWished] = useState(false);
  const [size, setSize] = useState('M');
  const [color, setColor] = useState(0);

  useEffect(() => {
    if (profile) fetchWishlistIds(profile.id).then((ids) => setWished(ids.has(id)));
  }, [profile, id]);

  if (!product) return null;

  async function toggleWish() {
    if (!profile) return;
    setWished((w) => !w);
    await toggleWishlist(profile.id, product!.id, wished);
    toast(wished ? 'Removed from wishlist' : 'Added to wishlist');
  }

  async function openChat() {
    if (!profile) return;
    const conversationId = await getOrCreateConversation(profile.id, product!.boutique_id);
    navigate(`/buyer/chat/${conversationId}`);
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="relative h-[360px]" style={{ background: toneHex(product.tone) }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center font-serif text-lg font-semibold text-black/40">
            {product.title}
          </div>
        )}
        <IconButton icon="arrow_back" onClick={() => navigate(-1)} bg="rgba(255,255,255,.92)" className="absolute left-4 top-3" />
        <IconButton
          icon={wished ? 'favorite' : 'favorite_border'}
          color={wished ? '#D6336C' : '#B79AA6'}
          onClick={toggleWish}
          bg="rgba(255,255,255,.92)"
          className="absolute right-4 top-3"
        />
      </div>
      <div className="flex-1 px-5 pb-5 pt-4.5">
        {product.featured && (
          <span className="inline-block rounded-lg bg-[#FBF0DA] px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-gold">
            FEATURED · PREMIUM
          </span>
        )}
        <div className="mt-2 flex items-start justify-between gap-2.5">
          <div className="flex-1 font-serif text-[28px] font-bold leading-[1.1]">{product.title}</div>
          <div className="whitespace-nowrap text-2xl font-extrabold text-rose-primaryDark">{fmtInr(product.price)}</div>
        </div>
        <div
          onClick={() => navigate(`/buyer/boutique/${product.boutique_id}`)}
          className="mt-2.5 flex cursor-pointer items-center gap-2 rounded-2xl bg-rose-card p-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-rose-chip font-serif font-bold text-black/55">
            {product.boutique?.name?.[0]}
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-bold">{product.boutique?.name}</div>
            <div className="text-xs text-rose-muted">
              {product.boutique?.city} · ⭐ {product.rating}
            </div>
          </div>
          <Icon name="chevron_right" className="text-rose-mutedSoft" />
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div>
            <div className="text-xs font-bold text-rose-muted">Size</div>
            <div className="mt-1.5 flex gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.5px] text-[13px] font-bold"
                  style={{
                    borderColor: size === s ? '#D6336C' : '#F0D8E2',
                    background: size === s ? '#FCE0EC' : 'transparent',
                    color: size === s ? '#B02454' : '#2A1A20',
                    fontWeight: size === s ? 800 : 700,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-rose-muted">Colour</div>
            <div className="mt-1.5 flex gap-1.5">
              {COLORS.map((hex, i) => (
                <button
                  key={hex}
                  onClick={() => setColor(i)}
                  className="h-[34px] w-[34px] rounded-full border-none"
                  style={{ background: hex, boxShadow: color === i ? '0 0 0 2px #D6336C' : 'none' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4.5 text-sm font-extrabold">Details</div>
        <div className="mt-1.5 text-[13.5px] leading-relaxed text-rose-label">
          Fabric: {product.fabric} · Occasion: {product.occasion}. Handcrafted with intricate zari work, tailored for a graceful drape.
          Blouse fabric included.
        </div>
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2.5 border-t border-rose-borderMid bg-white px-5 pb-4 pt-3">
        <div className="flex gap-2.5">
          <button onClick={openChat} className="flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-rose-primary bg-white text-[15px] font-extrabold text-rose-primaryDark">
            <Icon name="chat" className="text-xl" />
            Chat
          </button>
          <button
            onClick={() => toast('Opening WhatsApp…')}
            className="flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-2xl border-none bg-[#25A566] text-[15px] font-extrabold text-white shadow-[0_12px_26px_-14px_rgba(37,165,102,.9)]"
          >
            <Icon name="chat_bubble" className="text-xl" />
            WhatsApp
          </button>
        </div>
        <button
          onClick={() => {
            toggleWish();
          }}
          className="flex h-[52px] w-full items-center justify-center gap-1.5 rounded-2xl border-none text-[15px] font-extrabold text-white shadow-button"
          style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
        >
          <Icon name="favorite" className="text-xl" />
          Add to Wishlist
        </button>
      </div>
    </div>
  );
}
