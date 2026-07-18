import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { TONES, fmt } from '@/data/demo';
import { useCatalog } from '@/state/CatalogContext';

export function Featured() {
  const { products, loading } = useCatalog();
  const featured = products.filter((p) => p.featured);

  return (
    <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:16px;')}>
      {!loading && featured.length === 0 && (
        <div style={css('color:#8A7078;font-size:13.5px;')}>No featured products yet.</div>
      )}
      {featured.map((p) => (
        <div key={p.id} style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
          <div style={css(`height:150px;background:${TONES[p.tone]};position:relative;`)}>
            <ImageSlot src={p.image} placeholder={p.title} style={css('position:absolute;inset:0;')} />
            <span style={css('position:absolute;left:10px;top:10px;background:#C99A3F;color:#fff;font-size:10px;font-weight:800;padding:3px 9px;border-radius:8px;')}>FEATURED</span>
          </div>
          <div style={css('padding:12px 14px;')}>
            <div style={css('font-weight:700;font-size:14px;')}>{p.title}</div>
            <div style={css('font-size:12px;color:#8A7078;')}>{p.boutique} · {fmt(p.price)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
