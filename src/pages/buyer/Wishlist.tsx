import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchWishlist, toggleWishlist } from '@/data/wishlist';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ProductCard } from '@/components/buyer/ProductCard';

export function Wishlist() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: items, reload } = useAsync(() => (profile ? fetchWishlist(profile.id) : Promise.resolve([])), [profile?.id]);

  async function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!profile) return;
    await toggleWishlist(profile.id, id, true);
    reload();
  }

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-1.5">
        <IconButton icon="arrow_back" onClick={() => navigate(-1)} />
        <div className="font-serif text-[26px] font-bold">Wishlist</div>
      </div>

      {items && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3.5 px-5 md:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} wished onToggleWish={(e) => handleRemove(e, p.id)} onOpen={() => navigate(`/buyer/product/${p.id}`)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center px-7 py-14 text-center">
          <div className="flex h-[74px] w-[74px] items-center justify-center rounded-3xl bg-rose-chip">
            <Icon name="favorite_border" style={{ fontSize: 38, color: '#D6336C' }} />
          </div>
          <div className="mt-4 font-serif text-2xl font-bold">Your wishlist is empty</div>
          <div className="mt-1.5 text-sm text-rose-muted">Tap the heart on any piece to save it here.</div>
          <button onClick={() => navigate('/buyer/home')} className="mt-4 rounded-xl border-none bg-rose-primaryDark px-5 py-2.5 font-bold text-white">
            Browse collections
          </button>
        </div>
      )}
    </div>
  );
}
