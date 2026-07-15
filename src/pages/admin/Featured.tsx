import { useAsync } from '@/hooks/useAsync';
import { fetchFeaturedProducts } from '@/data/products';
import { toneHex } from '@/lib/tokens';
import { fmtInr } from '@/lib/tokens';

export function Featured() {
  const { data: products } = useAsync(fetchFeaturedProducts, []);

  return (
    <div className="grid grid-cols-3 gap-4">
      {(products ?? []).map((p) => (
        <div key={p.id} className="overflow-hidden rounded-[18px] bg-white shadow-soft">
          <div className="relative h-[150px]" style={{ background: toneHex(p.tone) }}>
            {p.image_url && <img src={p.image_url} className="h-full w-full object-cover" />}
            <span className="absolute left-2.5 top-2.5 rounded-lg bg-gold px-2.5 py-1 text-[10px] font-extrabold text-white">FEATURED</span>
          </div>
          <div className="p-3.5">
            <div className="text-sm font-bold">{p.title}</div>
            <div className="text-xs text-rose-muted">
              {p.boutique?.name} · {fmtInr(p.price)}
            </div>
          </div>
        </div>
      ))}
      {products?.length === 0 && <div className="col-span-3 py-8 text-center text-sm text-rose-muted">No featured listings yet.</div>}
    </div>
  );
}
