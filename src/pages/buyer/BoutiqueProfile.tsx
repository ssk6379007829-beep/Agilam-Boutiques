import { useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { fetchBoutique } from '@/data/boutiques';
import { fetchProductsByBoutique } from '@/data/products';
import { useAuth } from '@/auth/AuthContext';
import { getOrCreateConversation } from '@/data/chat';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { ProductCard } from '@/components/buyer/ProductCard';
import { toneHex } from '@/lib/tokens';
import { useToast } from '@/components/ui/Toast';

export function BoutiqueProfile() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { data: boutique } = useAsync(() => fetchBoutique(id), [id]);
  const { data: products } = useAsync(() => fetchProductsByBoutique(id), [id]);

  if (!boutique) return null;

  async function openChat() {
    if (!profile) return;
    const conversationId = await getOrCreateConversation(profile.id, boutique!.id);
    navigate(`/buyer/chat/${conversationId}`);
  }

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="relative h-40" style={{ background: 'linear-gradient(120deg,#B02454,#D6336C)' }}>
        <IconButton icon="arrow_back" onClick={() => navigate(-1)} bg="rgba(255,255,255,.9)" className="absolute left-4 top-3" />
      </div>
      <div className="relative -mt-9 px-5">
        <Avatar name={boutique.name} size={80} radius={22} tone={toneHex(boutique.tone)} fontSize={34} style={{ border: '3px solid #FDEEF4' }} />
        <div className="mt-2.5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-[26px] font-bold">{boutique.name}</span>
              {boutique.verified && <Icon name="verified" className="text-[19px]" style={{ color: '#3A8DD6' }} />}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[13px] text-rose-muted">
              <span className="flex items-center gap-0.5">
                <Icon name="location_on" className="text-[15px]" />
                {boutique.city}
              </span>
              <span className="flex items-center gap-0.5 font-bold text-rose-label">
                <Icon name="star" className="text-[15px]" style={{ color: '#E0B84B' }} />
                {boutique.rating} · {boutique.reviews_count}
              </span>
            </div>
          </div>
          <button
            onClick={() => toast('Following ' + boutique.name)}
            className="rounded-xl border-none px-4.5 py-2.5 text-[13px] font-extrabold text-white shadow-button"
            style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
          >
            + Follow
          </button>
        </div>
        <div className="mt-3 text-[13.5px] leading-relaxed text-rose-label">{boutique.description}</div>
        <div className="mt-4.5 flex items-center gap-2">
          <button onClick={openChat} className="flex-1 rounded-2xl border-[1.5px] border-rose-primary bg-white py-2.5 text-sm font-extrabold text-rose-primaryDark">
            <Icon name="chat" className="mr-1.5 align-middle" />
            Chat
          </button>
        </div>
        <div className="mt-4.5 font-serif text-[22px] font-bold">Collections</div>
      </div>
      <div className="grid grid-cols-2 gap-3.5 px-5 pt-3 md:grid-cols-3">
        {(products ?? []).map((p) => (
          <ProductCard key={p.id} product={p} imageHeight={170} onOpen={() => navigate(`/buyer/product/${p.id}`)} />
        ))}
        {products?.length === 0 && <div className="col-span-2 pt-4 text-center text-sm text-rose-muted">No products listed yet.</div>}
      </div>
    </div>
  );
}
