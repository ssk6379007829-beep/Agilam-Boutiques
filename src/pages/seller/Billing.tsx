import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchProductsByBoutique } from '@/data/products';
import { createOfflineSale, type OfflineSaleItem, type OfflineSaleResult } from '@/data/offlineSales';
import { buildWhatsAppLink, formatBillMessage } from '@/lib/whatsapp';
import { TONES, fmt } from '@/data/demo';

type CartLine = OfflineSaleItem & { key: string; stock: number | null };

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Other'];
const inputStyle = 'width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:0 14px;height:48px;font-size:14px;font-weight:600;';
const labelStyle = 'font-size:13px;font-weight:700;color:#7A5C67;';
const cardStyle = 'background:#fff;border-radius:16px;padding:14px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);';

export function Billing() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutique } = useMyBoutique();
  const { data: products } = useAsync(() => (boutique ? fetchProductsByBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [custom, setCustom] = useState({ title: '', price: '', qty: '1' });
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [creating, setCreating] = useState(false);
  const [receipt, setReceipt] = useState<OfflineSaleResult | null>(null);

  const filtered = (products ?? []).filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()));

  const addProduct = (p: NonNullable<typeof products>[number]) => {
    setCart((c) => {
      const existing = c.find((l) => l.product_id === p.id);
      const stock = p.stock;
      if (existing) {
        if (existing.qty >= stock) {
          showToast('No more stock left');
          return c;
        }
        return c.map((l) => (l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      if (stock <= 0) {
        showToast('Out of stock');
        return c;
      }
      return [...c, { key: p.id, product_id: p.id, title: p.title, price: Number(p.price), qty: 1, stock }];
    });
  };

  const setQty = (key: string, qty: number) => {
    setCart((c) => c
      .map((l) => (l.key === key ? { ...l, qty: l.stock != null ? Math.min(qty, l.stock) : qty } : l))
      .filter((l) => l.qty > 0));
  };

  const removeLine = (key: string) => setCart((c) => c.filter((l) => l.key !== key));

  const addCustom = () => {
    if (!custom.title.trim() || !custom.price.trim() || Number(custom.price) <= 0) {
      showToast('Enter an item name and price');
      return;
    }
    setCart((c) => [...c, {
      key: `custom-${Date.now()}`,
      product_id: null,
      title: custom.title.trim(),
      price: Number(custom.price),
      qty: Math.max(1, Number(custom.qty) || 1),
      stock: null,
    }]);
    setCustom({ title: '', price: '', qty: '1' });
  };

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const discountVal = Math.min(subtotal, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountVal);

  const generateBill = async () => {
    if (!boutique) return;
    if (cart.length === 0) {
      showToast('Add at least one item');
      return;
    }
    if (!buyerName.trim() || !buyerPhone.trim()) {
      showToast('Enter the buyer’s name and phone number');
      return;
    }
    setCreating(true);
    try {
      const result = await createOfflineSale({
        boutique_id: boutique.id,
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim(),
        items: cart.map(({ product_id, title, price, qty }) => ({ product_id, title, price, qty })),
        discount: discountVal,
        payment_method: paymentMethod,
      });
      setReceipt(result);
      showToast('Bill generated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not generate the bill');
    } finally {
      setCreating(false);
    }
  };

  const newBill = () => {
    setCart([]);
    setBuyerName('');
    setBuyerPhone('');
    setDiscount('');
    setPaymentMethod('Cash');
    setReceipt(null);
  };

  const sendWhatsApp = () => {
    if (!receipt) return;
    const message = formatBillMessage({
      boutiqueName: boutique?.name ?? 'Agilam Boutique',
      boutiquePhone: boutique?.phone,
      billNumber: receipt.order_number,
      date: new Date(receipt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      buyerName,
      items: cart.map((l) => ({ title: l.title, qty: l.qty, price: l.price })),
      discount: discountVal,
      total: receipt.total,
    });
    window.open(buildWhatsAppLink(buyerPhone, message), '_blank', 'noopener,noreferrer');
  };

  if (receipt) {
    return (
      <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:24px;')}>
        <div className="agx-no-print" style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
          <button onClick={newBill} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
          </button>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>Bill generated</div>
        </div>

        <div style={css('padding:6px 20px 0;')}>
          <div style={css(`${cardStyle}padding:22px;`)}>
            <div style={css('text-align:center;')}>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>{boutique?.name ?? 'Agilam Boutique'}</div>
              <div style={css('color:#8A7078;font-size:12.5px;margin-top:4px;')}>Bill {receipt.order_number} · {new Date(receipt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            <div style={css('margin-top:16px;padding-top:14px;border-top:1px dashed #F0E2E9;font-size:13.5px;')}>
              <div style={css('display:flex;justify-content:space-between;color:#8A7078;')}><span>Billed to</span><span style={css('font-weight:700;color:#241019;')}>{buyerName}</span></div>
              <div style={css('display:flex;justify-content:space-between;color:#8A7078;margin-top:4px;')}><span>Phone</span><span style={css('font-weight:700;color:#241019;')}>{buyerPhone}</span></div>
              <div style={css('display:flex;justify-content:space-between;color:#8A7078;margin-top:4px;')}><span>Payment</span><span style={css('font-weight:700;color:#241019;')}>{paymentMethod}</span></div>
            </div>
            <div style={css('margin-top:14px;padding-top:14px;border-top:1px dashed #F0E2E9;')}>
              {cart.map((l) => (
                <div key={l.key} style={css('display:flex;justify-content:space-between;font-size:13.5px;padding:5px 0;')}>
                  <span style={css('color:#4B3840;')}>{l.title} <span style={css('color:#B79AA6;')}>× {l.qty}</span></span>
                  <span style={css('font-weight:700;')}>{fmt(l.price * l.qty)}</span>
                </div>
              ))}
            </div>
            <div style={css('margin-top:10px;padding-top:10px;border-top:1px dashed #F0E2E9;font-size:13.5px;')}>
              <div style={css('display:flex;justify-content:space-between;color:#8A7078;')}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {discountVal > 0 && <div style={css('display:flex;justify-content:space-between;color:#2FA36B;margin-top:4px;')}><span>Discount</span><span>-{fmt(discountVal)}</span></div>}
              <div style={css('display:flex;justify-content:space-between;font-weight:800;font-size:16px;margin-top:8px;')}><span>Total</span><span style={css('color:#B02454;')}>{fmt(receipt.total)}</span></div>
            </div>
          </div>

          <div className="agx-no-print" style={css('display:flex;flex-direction:column;gap:10px;margin-top:16px;')}>
            <button onClick={sendWhatsApp} style={css('width:100%;height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#2FA36B,#1E8A57);color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>chat</span>Send via WhatsApp
            </button>
            <button onClick={() => window.print()} style={css('width:100%;height:48px;border:1.5px solid #F0D8E2;background:#fff;color:#4B3840;border-radius:14px;font-weight:800;font-size:14px;cursor:pointer;')}>Print / Save</button>
            <button onClick={() => navigate(`/seller/orders/${encodeURIComponent(receipt.id)}`)} style={css('width:100%;height:48px;border:1.5px solid #F0D8E2;background:#fff;color:#4B3840;border-radius:14px;font-weight:800;font-size:14px;cursor:pointer;')}>View in Orders</button>
            <button onClick={newBill} style={css('width:100%;height:48px;border:none;background:transparent;color:#B02454;font-weight:800;font-size:14px;cursor:pointer;')}>New bill</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:24px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/dashboard')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>New Bill</div>
      </div>

      <div style={css('padding:6px 20px 0;display:flex;flex-direction:column;gap:14px;')}>
        <div style={css(cardStyle)}>
          <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>ADD ITEMS FROM YOUR STORE</div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your products…" style={css(inputStyle)} />
          <div style={css('display:flex;flex-direction:column;gap:8px;margin-top:10px;max-height:220px;overflow-y:auto;')}>
            {filtered.map((p) => (
              <div key={p.id} onClick={() => addProduct(p)} style={css('display:flex;align-items:center;gap:10px;padding:8px;border-radius:12px;cursor:pointer;')}>
                <div style={css(`width:40px;height:40px;flex:none;border-radius:10px;background:${TONES[p.tone]};position:relative;overflow:hidden;`)}>
                  <ImageSlot src={p.image_url ?? undefined} placeholder={p.title} style={css('position:absolute;inset:0;')} />
                </div>
                <div style={css('flex:1;min-width:0;')}>
                  <div style={css('font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</div>
                  <div style={css('font-size:11.5px;color:#8A7078;')}>{fmt(Number(p.price))} · {p.stock} in stock</div>
                </div>
                <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;")}>add_circle</span>
              </div>
            ))}
            {filtered.length === 0 && <div style={css('color:#8A7078;font-size:13px;padding:6px 2px;')}>No products found.</div>}
          </div>
        </div>

        <div style={css(cardStyle)}>
          <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>CUSTOM ITEM (off-catalog)</div>
          <div style={css('display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;')}>
            <input value={custom.title} onChange={(e) => setCustom((c) => ({ ...c, title: e.target.value }))} placeholder="Item name" style={css(`${inputStyle}flex:2;min-width:120px;`)} />
            <input value={custom.price} onChange={(e) => setCustom((c) => ({ ...c, price: e.target.value }))} inputMode="numeric" placeholder="Price" style={css(`${inputStyle}flex:1;min-width:80px;`)} />
            <input value={custom.qty} onChange={(e) => setCustom((c) => ({ ...c, qty: e.target.value }))} inputMode="numeric" placeholder="Qty" style={css(`${inputStyle}width:64px;flex:none;`)} />
          </div>
          <button onClick={addCustom} style={css('margin-top:10px;width:100%;height:42px;border:1.5px dashed #E6BCCF;background:#fff;color:#B02454;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;')}>+ Add custom item</button>
        </div>

        {cart.length > 0 && (
          <div style={css(cardStyle)}>
            <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>BILL ITEMS</div>
            <div style={css('display:flex;flex-direction:column;gap:8px;margin-top:8px;')}>
              {cart.map((l) => (
                <div key={l.key} style={css('display:flex;align-items:center;gap:10px;')}>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{l.title}</div>
                    <div style={css('font-size:11.5px;color:#8A7078;')}>{fmt(l.price)} each</div>
                  </div>
                  <div style={css('display:flex;align-items:center;gap:8px;')}>
                    <button onClick={() => setQty(l.key, l.qty - 1)} style={css('width:28px;height:28px;border-radius:9px;border:1.5px solid #F0D8E2;background:#fff;cursor:pointer;')}>−</button>
                    <span style={css('font-weight:800;font-size:13px;width:18px;text-align:center;')}>{l.qty}</span>
                    <button onClick={() => setQty(l.key, l.qty + 1)} style={css('width:28px;height:28px;border-radius:9px;border:1.5px solid #F0D8E2;background:#fff;cursor:pointer;')}>+</button>
                  </div>
                  <span style={css('font-weight:800;font-size:13.5px;color:#B02454;width:74px;text-align:right;')}>{fmt(l.price * l.qty)}</span>
                  <button onClick={() => removeLine(l.key)} style={css('width:28px;height:28px;border:none;background:none;cursor:pointer;')}>
                    <span style={css("font-family:'Material Symbols Outlined';font-size:18px;color:#D6455A;")}>close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={css(cardStyle)}>
          <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>BUYER DETAILS</div>
          <label style={css(labelStyle)}>Name<input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Priya Sharma" style={css(inputStyle)} /></label>
          <label style={css(`${labelStyle}display:block;margin-top:10px;`)}>WhatsApp number<input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} inputMode="tel" placeholder="98765 43210" style={css(inputStyle)} /></label>
          <label style={css(`${labelStyle}display:block;margin-top:10px;`)}>Discount (₹) — optional<input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="numeric" placeholder="0" style={css(inputStyle)} /></label>
          <div style={css(`${labelStyle}margin-top:10px;`)}>Payment method</div>
          <div style={css('display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;')}>
            {PAYMENT_METHODS.map((m) => {
              const on = paymentMethod === m;
              return (
                <span key={m} onClick={() => setPaymentMethod(m)} style={css(`padding:9px 14px;border-radius:11px;border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : '#fff'};color:${on ? '#B02454' : '#4B3840'};font-weight:700;font-size:13px;cursor:pointer;`)}>{m}</span>
              );
            })}
          </div>
        </div>

        <div style={css(cardStyle)}>
          <div style={css('display:flex;justify-content:space-between;font-size:13.5px;color:#8A7078;')}><span>Subtotal</span><span style={css('font-weight:700;color:#2A1A20;')}>{fmt(subtotal)}</span></div>
          {discountVal > 0 && <div style={css('display:flex;justify-content:space-between;font-size:13.5px;color:#2FA36B;margin-top:4px;')}><span>Discount</span><span>-{fmt(discountVal)}</span></div>}
          <div style={css('display:flex;justify-content:space-between;margin-top:8px;font-weight:800;font-size:17px;')}><span>Total</span><span style={css('color:#B02454;')}>{fmt(total)}</span></div>
        </div>

        <button onClick={generateBill} disabled={creating} style={css(`width:100%;height:54px;border:none;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:${creating ? 'default' : 'pointer'};opacity:${creating ? 0.7 : 1};box-shadow:0 14px 30px -14px rgba(214,51,108,.8);`)}>
          {creating ? 'Generating…' : 'Generate Bill'}
        </button>
      </div>
    </div>
  );
}
