import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchProducts, type ProductFilters } from '@/data/products';
import { fetchWishlistIds, toggleWishlist } from '@/data/wishlist';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ProductCard } from '@/components/buyer/ProductCard';
import { FilterSheet } from '@/components/buyer/FilterSheet';
import { useToast } from '@/components/ui/Toast';

export function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const toast = useToast();
  const initialCategory = (location.state as { category?: string } | null)?.category;

  const [filters, setFilters] = useState<ProductFilters>({
    maxPrice: 10000,
    categories: initialCategory ? [initialCategory] : [],
    colors: [],
    occasions: [],
    sort: 'Latest',
  });
  const [query, setQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [wished, setWished] = useState<Set<string>>(new Set());

  const { data: results } = useAsync(() => fetchProducts(filters), [JSON.stringify(filters)]);
  const filtered = (results ?? []).filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (profile) fetchWishlistIds(profile.id).then(setWished);
  }, [profile]);

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

  const activeChips: { key: string; label: string }[] = [];
  if ((filters.maxPrice ?? 10000) < 10000) activeChips.push({ key: 'price', label: `Under ₹${filters.maxPrice}` });
  filters.categories?.forEach((c) => activeChips.push({ key: 'cat:' + c, label: c }));
  filters.colors?.forEach((c) => activeChips.push({ key: 'color:' + c, label: c }));
  filters.occasions?.forEach((c) => activeChips.push({ key: 'occ:' + c, label: c }));

  return (
    <div className="relative min-h-full bg-rose-card">
      <div className="sticky top-0 z-[5] bg-rose-card px-5 pb-3 pt-1.5">
        <div className="flex items-center gap-2.5">
          <IconButton icon="arrow_back" onClick={() => navigate('/buyer/home')} />
          <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-white px-3 shadow-card">
            <Icon name="search" className="text-[20px] text-rose-mutedSoft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ethnic wear"
              className="flex-1 border-none bg-transparent text-sm font-semibold outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilter(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border-none"
            style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
          >
            <Icon name="tune" className="text-[20px] text-white" />
          </button>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          <div className="flex flex-none items-center gap-1.5 rounded-full bg-rose-primaryDark px-3 py-1.5 text-[12.5px] font-bold text-white">
            <Icon name="tune" className="text-[15px]" />
            Sort: {filters.sort}
          </div>
          {activeChips.map((ch) => (
            <div
              key={ch.key}
              className="flex flex-none items-center gap-1.5 rounded-full border border-rose-border bg-white px-3 py-1.5 text-[12.5px] font-bold text-rose-primaryDark"
            >
              {ch.label}
              <Icon name="close" className="text-[15px]" />
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-1.5 pt-1 text-[13px] font-semibold text-rose-muted">{filtered.length} results</div>
      <div className="grid grid-cols-2 gap-3.5 px-5 pb-6 md:grid-cols-3">
        {filtered.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            showBoutique
            wished={wished.has(p.id)}
            onToggleWish={(e) => handleToggleWish(e, p.id)}
            onOpen={() => navigate(`/buyer/product/${p.id}`)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center px-7 py-10 text-center">
          <div className="flex h-[74px] w-[74px] items-center justify-center rounded-3xl bg-rose-chip">
            <Icon name="search_off" style={{ fontSize: 38, color: '#D6336C' }} />
          </div>
          <div className="mt-4 font-serif text-2xl font-bold">No matches found</div>
          <div className="mt-1.5 text-sm text-rose-muted">Try widening your price range or clearing a filter.</div>
          <button
            onClick={() => setFilters({ maxPrice: 10000, categories: [], colors: [], occasions: [], sort: 'Latest' })}
            className="mt-4 rounded-xl border-none bg-rose-primaryDark px-5 py-2.5 font-bold text-white"
          >
            Reset filters
          </button>
        </div>
      )}

      {showFilter && (
        <FilterSheet filters={filters} onChange={setFilters} onClose={() => setShowFilter(false)} resultsCount={filtered.length} />
      )}
    </div>
  );
}
