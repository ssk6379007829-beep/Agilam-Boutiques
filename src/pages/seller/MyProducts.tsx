import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { PRODUCTS, TONES, fmt } from '@/data/demo';

export function MyProducts() {
  const navigate = useNavigate();
  const { showToast } = useShop();

  const stockOf = (stock: number) =>
    stock === 0
      ? { label: 'Out of stock', bg: '#FBE3E3', fg: '#D6455A' }
      : stock <= 5
        ? { label: `Low · ${stock} left`, bg: '#FBF0DA', fg: '#C99A3F' }
        : { label: 'In stock', bg: '#E5F3EC', fg: '#2FA36B' };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;justify-content:space-between;')}>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>My Products</div>
        <button onClick={() => navigate('/seller/add-product')} style={css('background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:12px;padding:9px 14px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:5px;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>add</span>Add
        </button>
      </div>

      <div style={css('display:flex;flex-direction:column;gap:10px;padding:4px 20px 0;')}>
        {PRODUCTS.map((p) => {
          const st = stockOf(p.stock);
          return (
            <div key={p.id} style={css('background:#fff;border-radius:16px;padding:10px;display:flex;gap:11px;align-items:center;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
              <div style={css(`width:56px;height:56px;flex:none;border-radius:13px;background:${TONES[p.tone]};position:relative;overflow:hidden;`)}>
                <ImageSlot src={p.image} placeholder={p.title} style={css('position:absolute;inset:0;')} />
              </div>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css('font-weight:800;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</div>
                <div style={css('font-size:12px;color:#8A7078;')}>{p.cat} · {fmt(p.price)}</div>
                <span style={css(`display:inline-block;margin-top:4px;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:7px;background:${st.bg};color:${st.fg};`)}>{st.label}</span>
              </div>
              <button onClick={() => showToast('Editing ' + p.title)} style={css('width:36px;height:36px;border-radius:11px;border:1.5px solid #F0D8E2;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:18px;color:#B02454;")}>edit</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
