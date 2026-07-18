import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { TONES, fmt } from '@/data/demo';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchProductsByBoutique, updateProduct, deleteProduct } from '@/data/products';

type Row = { id: string; title: string; cat: string; price: number; stock: number; tone: number; image: string };
type EditForm = { title: string; category: string; price: string; stock: string };

const inputStyle = 'width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:0 14px;height:48px;font-size:14px;font-weight:600;';

export function MyProducts() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutique } = useMyBoutique();
  const { data: rows, loading, reload } = useAsync(() => (boutique ? fetchProductsByBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);
  const products: Row[] = (rows ?? []).map((p) => ({
    id: p.id, title: p.title, cat: p.category, price: Number(p.price), stock: p.stock, tone: p.tone, image: p.image_url ?? '',
  }));

  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<EditForm>({ title: '', category: '', price: '', stock: '' });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openEdit = (p: Row) => {
    setEditing(p);
    setForm({ title: p.title, category: p.cat, price: String(p.price), stock: String(p.stock) });
    setConfirmDelete(false);
  };
  const closeEdit = () => {
    if (busy) return;
    setEditing(null);
    setConfirmDelete(false);
  };
  const set = (key: keyof EditForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!editing) return;
    if (!form.title.trim()) {
      showToast('Please enter a product title');
      return;
    }
    setBusy(true);
    try {
      await updateProduct(editing.id, {
        title: form.title.trim(),
        category: form.category.trim() || 'Other',
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
      });
      showToast('Product updated');
      setEditing(null);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update product');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteProduct(editing.id);
      showToast('Product deleted');
      setEditing(null);
      setConfirmDelete(false);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete product');
    } finally {
      setBusy(false);
    }
  };

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
        {!loading && products.length === 0 && (
          <div style={css('color:#8A7078;font-size:14px;padding:8px 2px;')}>No products yet — tap Add to list your first piece.</div>
        )}
        {products.map((p) => {
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
              <button onClick={() => openEdit(p)} style={css('width:36px;height:36px;border-radius:11px;border:1.5px solid #F0D8E2;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:18px;color:#B02454;")}>edit</span>
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <div onClick={closeEdit} style={css('position:fixed;inset:0;z-index:50;background:rgba(42,16,25,.42);display:flex;align-items:flex-end;justify-content:center;')}>
          <div onClick={(e) => e.stopPropagation()} style={css('width:100%;max-width:520px;background:#FBF6F2;border-radius:22px 22px 0 0;padding:18px 20px 24px;box-shadow:0 -18px 40px -20px rgba(107,20,54,.5);')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;")}>Edit product</div>
              <button onClick={closeEdit} style={css('width:36px;height:36px;border-radius:11px;border:none;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>close</span>
              </button>
            </div>

            <div style={css('display:flex;flex-direction:column;gap:12px;margin-top:16px;')}>
              <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
                Product title<input value={form.title} onChange={(e) => set('title', e.target.value)} style={css(inputStyle)} />
              </label>
              <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
                Category<input value={form.category} onChange={(e) => set('category', e.target.value)} style={css(inputStyle)} />
              </label>
              <div style={css('display:flex;gap:12px;')}>
                <label style={css('flex:1;font-size:13px;font-weight:700;color:#7A5C67;')}>
                  Price (₹)<input value={form.price} onChange={(e) => set('price', e.target.value)} inputMode="numeric" style={css(inputStyle)} />
                </label>
                <label style={css('flex:1;font-size:13px;font-weight:700;color:#7A5C67;')}>
                  Stock<input value={form.stock} onChange={(e) => set('stock', e.target.value)} inputMode="numeric" style={css(inputStyle)} />
                </label>
              </div>
            </div>

            <button onClick={save} disabled={busy} style={css(`width:100%;height:52px;margin-top:18px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:15px;cursor:${busy ? 'default' : 'pointer'};opacity:${busy ? 0.7 : 1};`)}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>

            {confirmDelete ? (
              <div style={css('margin-top:12px;background:#FBE3E3;border:1px solid #F0BEC5;border-radius:14px;padding:12px 14px;')}>
                <div style={css('font-size:13px;font-weight:700;color:#8A2A34;')}>Delete “{editing.title}”? This can't be undone.</div>
                <div style={css('display:flex;gap:10px;margin-top:10px;')}>
                  <button onClick={() => setConfirmDelete(false)} disabled={busy} style={css('flex:1;height:44px;border:1.5px solid #E0C8CF;background:#fff;color:#6B5560;border-radius:12px;font-weight:800;cursor:pointer;')}>Cancel</button>
                  <button onClick={remove} disabled={busy} style={css(`flex:1;height:44px;border:none;background:#D6455A;color:#fff;border-radius:12px;font-weight:800;cursor:${busy ? 'default' : 'pointer'};opacity:${busy ? 0.7 : 1};`)}>{busy ? 'Deleting…' : 'Delete'}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} disabled={busy} style={css('width:100%;height:48px;margin-top:10px;border:1.5px solid #E7A7B4;background:#fff;color:#D6455A;border-radius:14px;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;')}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>delete</span>Delete product
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
