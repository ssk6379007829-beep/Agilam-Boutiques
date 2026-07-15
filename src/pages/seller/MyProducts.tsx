import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchProductsByBoutique } from '@/data/products';
import { Icon } from '@/components/ui/Icon';
import { fmtInr, stockInfo, toneHex } from '@/lib/tokens';
import { useToast } from '@/components/ui/Toast';

export function MyProducts() {
  const navigate = useNavigate();
  const toast = useToast();
  const { boutique } = useMyBoutique();
  const { data: products } = useAsync(() => (boutique ? fetchProductsByBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="flex items-center justify-between px-5 pb-3 pt-1.5">
        <div className="font-serif text-[26px] font-bold">My Products</div>
        <button
          onClick={() => navigate('/seller/add-product')}
          className="flex items-center gap-1.5 rounded-xl border-none px-3.5 py-2.5 text-[13px] font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
        >
          <Icon name="add" className="text-lg" />
          Add
        </button>
      </div>
      <div className="flex flex-col gap-2.5 px-5">
        {(products ?? []).map((p) => {
          const stock = stockInfo(p.stock);
          return (
            <div key={p.id} className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-card">
              <div className="relative h-14 w-14 flex-none overflow-hidden rounded-[13px]" style={{ background: toneHex(p.tone) }}>
                {p.image_url && <img src={p.image_url} className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-extrabold">{p.title}</div>
                <div className="text-xs text-rose-muted">
                  {p.category} · {fmtInr(p.price)}
                </div>
                <span className="mt-1 inline-block rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: stock.bg, color: stock.fg }}>
                  {stock.label}
                </span>
              </div>
              <button
                onClick={() => toast('Editing ' + p.title)}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] border-[1.5px] border-rose-border bg-white"
              >
                <Icon name="edit" className="text-lg" style={{ color: '#B02454' }} />
              </button>
            </div>
          );
        })}
        {products?.length === 0 && (
          <div className="pt-8 text-center text-sm text-rose-muted">No products yet — tap Add to publish your first listing.</div>
        )}
      </div>
    </div>
  );
}
