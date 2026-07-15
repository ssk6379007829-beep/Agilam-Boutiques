import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchProducts } from '@/data/products';
import { fetchWishlistIds, toggleWishlist } from '@/data/wishlist';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ProductCard } from '@/components/buyer/ProductCard';
import { useToast } from '@/components/ui/Toast';

const CATEGORIES = [
  { name: 'Sarees', icon: 'checkroom' },
  { name: 'Lehengas', icon: 'apparel' },
  { name: 'Gowns', icon: 'woman' },
  { name: 'Kurtis', icon: 'styler' },
  { name: 'Bridal', icon: 'diamond' },
  { name: 'More', icon: 'grid_view' },
];

const HERO_SLIDES = [
  { tag: 'Latest Collection', pre: 'New Arrivals for ', accent: 'Wedding', post: ' Season', sub: 'Handpicked bridal edits from 200+ boutiques' },
  { tag: 'Festive Edit', pre: 'Pure Silk ', accent: 'Sarees', post: '', sub: 'Direct from the Kanchipuram looms' },
  { tag: 'Under ₹8,000', pre: 'Party-ready ', accent: 'Lehengas', post: '', sub: 'Ready to ship across Tamil Nadu' },
];

export function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const { data: products } = useAsync(() => fetchProducts({ sort: 'Latest' }), []);
  const [wished, setWished] = useState<Set<string>>(new Set());
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (profile) fetchWishlistIds(profile.id).then(setWished);
  }, [profile]);

  useEffect(() => {
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length), 4200);
    return () => clearInterval(t);
  }, []);

  async function handleToggleWish(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!profile) return;
    const isWished = wished.has(id);
    setWished((prev) => {
      const next = new Set(prev);
      isWished ? next.delete(id) : next.add(id);
      return next;
    });
    await toggleWishlist(profile.id, id, isWished);
    toast(isWished ? 'Removed from wishlist' : 'Added to wishlist');
  }

  const first = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="px-5 pb-3.5 pt-1.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] text-rose-muted">Good morning ✨</div>
            <div className="font-serif text-[26px] font-bold leading-none">Hello, {first}</div>
          </div>
          <IconButton icon="favorite" onClick={() => navigate('/buyer/wishlist')} />
        </div>
        <div className="mt-3.5 flex gap-2.5">
          <div className="flex h-[50px] flex-1 items-center gap-2.5 rounded-2xl bg-white px-3.5 shadow-card">
            <Icon name="search" className="text-rose-mutedSoft" />
            <input
              placeholder="Search sarees, lehengas, boutiques…"
              className="flex-1 border-none bg-transparent text-sm font-medium outline-none"
              onKeyDown={(e) => e.key === 'Enter' && navigate('/buyer/results')}
            />
          </div>
          <button
            onClick={() => navigate('/buyer/results')}
            className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl border-none shadow-button"
            style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
          >
            <Icon name="tune" className="text-white" />
          </button>
        </div>
      </div>

      <div
        className="relative mx-5 h-[210px] overflow-hidden rounded-3xl"
        style={{ background: 'linear-gradient(120deg,#8E1C44,#B02454 55%,#D6336C)', boxShadow: '0 22px 46px -22px rgba(142,28,68,.75)' }}
      >
        <div className="flex h-full transition-transform duration-500" style={{ transform: `translateX(-${heroIndex * 100}%)` }}>
          {HERO_SLIDES.map((h) => (
            <div key={h.tag} className="relative h-full flex-none" style={{ flexBasis: '100%' }}>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(100deg,rgba(60,10,32,.88) 0%,rgba(120,24,60,.6) 48%,rgba(120,24,60,.1) 100%)' }}
              />
              <div className="relative flex h-full flex-col justify-center px-[22px] py-5 text-white">
                <div
                  className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wider"
                  style={{ background: 'rgba(201,154,63,.22)', border: '1px solid rgba(226,190,120,.55)', color: '#F4D9A6' }}
                >
                  <Icon name="auto_awesome" className="text-sm" />
                  {h.tag}
                </div>
                <div className="mt-2 max-w-[250px] font-serif text-[29px] font-bold leading-[1.08]" style={{ textShadow: '0 2px 14px rgba(60,10,32,.5)' }}>
                  {h.pre}
                  <span className="italic" style={{ color: '#F4D9A6' }}>
                    {h.accent}
                  </span>
                  {h.post}
                </div>
                <div className="mt-1 text-[12.5px] font-medium opacity-90" style={{ textShadow: '0 1px 8px rgba(60,10,32,.5)' }}>
                  {h.sub}
                </div>
                <button
                  onClick={() => navigate('/buyer/results')}
                  className="mt-3.5 flex w-fit items-center gap-1.5 rounded-xl border-none bg-white px-4.5 py-2.5 text-[13px] font-extrabold text-rose-primaryDark"
                >
                  Shop now <Icon name="arrow_forward" className="text-[17px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute bottom-3.5 right-4 z-[3] flex gap-1.5">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIndex(i)}
              className="h-[5px] rounded-full border-none p-0 transition-all"
              style={{ width: i === heroIndex ? 18 : 5, background: i === heroIndex ? '#F4D9A6' : 'rgba(255,255,255,.55)' }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pb-2.5 pt-5">
        <div className="font-serif text-[22px] font-bold">Categories</div>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.name}
            onClick={() => navigate('/buyer/results', { state: { category: c.name } })}
            className="flex w-16 flex-none flex-col items-center gap-1.5 border-none bg-transparent"
          >
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-white shadow-card">
              <Icon name={c.icon} className="text-[28px]" style={{ color: '#D6336C' }} />
            </div>
            <span className="text-xs font-bold text-rose-label">{c.name}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <div className="font-serif text-[22px] font-bold">Recommended for you</div>
        <a onClick={() => navigate('/buyer/results')} className="cursor-pointer text-[13px] font-bold">
          See all
        </a>
      </div>
      <div className="no-scrollbar flex gap-3.5 overflow-x-auto px-5 pb-1">
        {(products ?? []).slice(0, 6).map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            width={158}
            imageHeight={200}
            showRating
            onOpen={() => navigate(`/buyer/product/${p.id}`)}
          />
        ))}
      </div>

      <div className="px-5 pb-3 pt-5.5 font-serif text-[22px] font-bold">Popular Dresses</div>
      <div className="grid grid-cols-2 gap-3.5 px-5">
        {(products ?? []).map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            wished={wished.has(p.id)}
            onToggleWish={(e) => handleToggleWish(e, p.id)}
            onOpen={() => navigate(`/buyer/product/${p.id}`)}
          />
        ))}
      </div>
      {products?.length === 0 && (
        <div className="px-5 pt-6 text-center text-sm text-rose-muted">No products yet — check back soon, or ask boutiques to list their collections.</div>
      )}
    </div>
  );
}
