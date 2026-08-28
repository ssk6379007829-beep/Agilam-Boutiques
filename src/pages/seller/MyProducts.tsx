import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { errMessage } from '@/lib/errMessage';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { TONES, fmt } from '@/data/demo';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchProductsByBoutique, updateProduct, deleteProduct } from '@/data/products';
import { ProductForm, readSizeStock, type ProductFormValues } from '@/components/seller/ProductForm';
import { BOUTIQUE_STATUS_LABEL } from '@/data/types';
import type { ProductWithBoutique } from '@/data/types';

export function MyProducts() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutique } = useMyBoutique();
  const { data: rows, loading, reload } = useAsync(() => (boutique ? fetchProductsByBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);
  const products = rows ?? [];

  // Until the shop is approved, RLS hides every one of these products from
  // buyers (schema.sql "products: public read from approved boutiques"). The
  // seller still sees them here as the owner, so without this reminder the page
  // looks live when it is not. Approval flips them all visible at once.
  const pendingReview = !!boutique && boutique.status !== 'approved';

  const [editing, setEditing] = useState<ProductWithBoutique | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openEdit = (p: ProductWithBoutique) => {
    setEditing(p);
    setConfirmDelete(false);
  };
  const closeEdit = () => {
    if (busy) return;
    setEditing(null);
    setConfirmDelete(false);
  };

  /** The saved product as the form reads it. Shared by the edit modal and by
   *  "Add another colour" from the list, so a colour started from the row and a
   *  colour started from the form copy exactly the same fields. */
  const formValuesOf = (p: ProductWithBoutique): Partial<ProductFormValues> => ({
    title: p.title,
    category: p.category,
    color: p.color ?? '',
    occasion: p.occasion ?? '',
    fabric: p.fabric ?? '',
    price: String(p.price),
    stock: String(p.stock),
    description: p.description ?? '',
    mrp: p.mrp != null ? String(p.mrp) : '',
    weightGrams: p.weight_grams != null ? String(p.weight_grams) : '',
    sizes: p.sizes ?? [],
    // A product listed before 0103 has no map; the form then asks the seller to
    // split its pooled stock rather than inventing a split for them.
    sizeStock: Object.fromEntries(Object.entries(p.size_stock ?? {}).map(([s, n]) => [s, String(n)])),
    variantGroupId: p.variant_group_id ?? '',
    washCare: p.wash_care ?? '',
    imageUrl: p.image_url ?? '',
    images: p.images ?? [],
    badges: p.badges ?? [],
    feedingFriendly: p.feeding_friendly ?? false,
    feedingNote: p.feeding_note ?? '',
    shippingInfo: p.shipping_info ?? '',
    colorDisclaimer: p.color_disclaimer ?? '',
    specs: p.specs ?? [],
  });

  /** Give a piece a colour set to belong to, creating one on first use. A set is
   *  just a shared id — the products stay separate rows either way. */
  const ensureGroup = async (p: ProductWithBoutique): Promise<string> => {
    if (p.variant_group_id) return p.variant_group_id;
    const groupId = crypto.randomUUID();
    await updateProduct(p.id, { variant_group_id: groupId });
    setEditing((cur) => (cur && cur.id === p.id ? { ...cur, variant_group_id: groupId } : cur));
    return groupId;
  };

  /**
   * Start another colour of a piece. Everything crosses over except the two
   * things that MUST differ — the colour itself and the photos, which have to
   * show the actual garment in that colour or the swatch lies to the buyer.
   * Price and stock come across as a starting point; a colour that costs more
   * is edited on the way through.
   */
  const addColour = async (p: ProductWithBoutique, values: Partial<ProductFormValues>) => {
    try {
      const variantGroupId = await ensureGroup(p);
      setEditing(null);
      navigate('/seller/add-product', {
        state: { prefill: { ...values, variantGroupId, color: '', imageUrl: '', images: [] } },
      });
    } catch (e) {
      showToast(errMessage(e, 'Could not start another colour'));
    }
  };

  /** Join a product the seller already listed to the open piece's colour set.
   *  Both rows are written straight away — this is its own action, not part of
   *  the form's save — and the picker only ever offers unset products. */
  const linkColour = async (candidateId: string): Promise<string> => {
    if (!editing) throw new Error('No product open');
    const groupId = await ensureGroup(editing);
    await updateProduct(candidateId, { variant_group_id: groupId });
    showToast('Linked as another colour');
    reload();
    return groupId;
  };

  const save = async (form: ProductFormValues) => {
    if (!editing) return;
    setBusy(true);
    try {
      const { size_stock, stock } = readSizeStock(form);
      await updateProduct(editing.id, {
        title: form.title.trim(),
        category: form.category.trim() || 'Other',
        price: Number(form.price) || 0,
        stock,
        size_stock,
        fabric: form.fabric.trim(),
        color: form.color.trim(),
        occasion: form.occasion.trim(),
        description: form.description.trim(),
        mrp: form.mrp.trim() ? Number(form.mrp) : null,
        weight_grams: form.weightGrams.trim() ? Number(form.weightGrams) : null,
        sizes: form.sizes,
        wash_care: form.washCare.trim(),
        image_url: form.imageUrl,
        images: form.images,
        badges: form.badges,
        feeding_friendly: form.feedingFriendly,
        feeding_note: form.feedingFriendly ? form.feedingNote.trim() : '',
        shipping_info: form.shippingInfo.trim(),
        color_disclaimer: form.colorDisclaimer.trim(),
        specs: form.specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
      });
      showToast('Product updated');
      setEditing(null);
      reload();
    } catch (e) {
      showToast(errMessage(e, 'Could not update product'));
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
      showToast(errMessage(e, 'Could not delete product'));
    } finally {
      setBusy(false);
    }
  };

  const stockOf = (stock: number) =>
    stock === 0
      ? { label: 'Out of stock', bg: 'var(--ag-bad-bg)', fg: 'var(--ag-danger-text)' }
      : stock <= 5
        ? { label: `Low · ${stock} left`, bg: 'var(--ag-warn-bg)', fg: 'var(--ag-gold-text)' }
        : { label: 'In stock', bg: 'var(--ag-good-bg)', fg: 'var(--ag-good-text)' };

  /** How many colours this piece is listed in, counted off the catalogue that
   *  is already loaded. A colour set can never span two boutiques (0103 guards
   *  it), so the seller's own rows are always the complete set. */
  const colourCount = (p: ProductWithBoutique) =>
    p.variant_group_id ? products.filter((x) => x.variant_group_id === p.variant_group_id).length : 1;

  const compact = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n));
  const metricsOf = (p: ProductWithBoutique) => [
    { icon: 'visibility', label: 'Views', value: compact(p.views_count ?? 0), ic: 'var(--ag-info-text)' },
    { icon: 'favorite', label: 'Likes', value: compact(p.likes_count ?? 0), ic: '#D6336C' },
    { icon: 'ios_share', label: 'Shares', value: compact(p.shares_count ?? 0), ic: '#9B7FC7' },
    { icon: 'bookmark', label: 'Saved', value: compact(p.wishlist_count ?? 0), ic: 'var(--ag-gold-text)' },
    { icon: 'shopping_bag', label: 'Sold', value: compact(p.sold_count ?? 0), ic: 'var(--ag-good)' },
    { icon: 'inventory_2', label: 'Stock', value: String(p.stock), ic: p.stock === 0 ? 'var(--ag-danger-text)' : 'var(--ag-label)' },
  ];

  return (
    <div style={css('min-height:100%;background:var(--ag-bg);padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;justify-content:space-between;')}>
        <h1 style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>My Products</h1>
        <button onClick={() => navigate('/seller/add-product')} style={css('background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:12px;padding:9px 14px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:5px;')}>
          <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>add</span>Add
        </button>
      </div>

      {pendingReview && products.length > 0 && (
        <div style={css('margin:0 20px 12px;')}>
          <button
            onClick={() => navigate('/seller/verification')}
            style={css('width:100%;text-align:left;background:var(--ag-info-bg);border:1px solid #CFDDF0;border-radius:16px;padding:13px 15px;display:flex;align-items:center;gap:11px;cursor:pointer;font-family:inherit;')}
          >
            <span style={css('width:38px;height:38px;flex:none;border-radius:12px;background:var(--ag-surface);display:flex;align-items:center;justify-content:center;')}>
              <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:21px;color:var(--ag-info-text);")}>visibility_off</span>
            </span>
            <span style={css('flex:1;min-width:0;')}>
              <span style={css('display:block;font-weight:800;font-size:13px;color:var(--ag-info-text);')}>Not visible to buyers yet</span>
              <span style={css('display:block;font-size:11.5px;font-weight:600;color:#4E688F;margin-top:2px;line-height:1.45;')}>Your shop is {BOUTIQUE_STATUS_LABEL[boutique!.status].toLowerCase()}. These products publish to buyers the moment your boutique is approved.</span>
            </span>
            <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:20px;color:var(--ag-info-text);")}>chevron_right</span>
          </button>
        </div>
      )}

      <div style={css('display:flex;flex-direction:column;gap:10px;padding:4px 20px 0;')}>
        {!loading && products.length === 0 && (
          <div style={css('color:var(--ag-muted);font-size:14px;padding:8px 2px;')}>No products yet — tap Add to list your first piece.</div>
        )}
        {products.map((p) => {
          const st = stockOf(p.stock);
          return (
            <div key={p.id} style={css('background:var(--ag-surface);border-radius:16px;padding:10px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
              <div
                onClick={() => navigate(`/seller/products/${p.id}`)}
                className="agx-lift"
                style={css('display:flex;gap:11px;align-items:center;cursor:pointer;')}
              >
                <div style={css(`width:56px;height:56px;flex:none;border-radius:13px;background:${TONES[p.tone % TONES.length]};position:relative;overflow:hidden;`)}>
                  <ImageSlot src={p.image_url ?? undefined} placeholder={p.title} style={css('position:absolute;inset:0;')} />
                </div>
                <div style={css('flex:1;min-width:0;')}>
                  <div style={css('font-weight:800;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{p.title}</div>
                  <div style={css('font-size:12px;color:var(--ag-muted);')}>{p.category} · {fmt(Number(p.price))}</div>
                  <span style={css('display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:4px;')}>
                    <span style={css(`font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:7px;background:${st.bg};color:${st.fg};`)}>{st.label}</span>
                    {/* Counted from the shop's own catalogue, already loaded — a
                        set never spans two boutiques, so this is the whole set. */}
                    {colourCount(p) > 1 && (
                      <span style={css('font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:7px;background:var(--ag-surface-2);color:var(--ag-crimson);')}>
                        {colourCount(p)} colours
                      </span>
                    )}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); void addColour(p, formValuesOf(p)); }}
                  aria-label={`Add another colour of ${p.title}`}
                  title="Add another colour"
                  style={css('width:36px;height:36px;flex:none;border-radius:11px;border:1.5px solid var(--ag-border);background:var(--ag-surface);cursor:pointer;display:flex;align-items:center;justify-content:center;')}
                >
                  <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:18px;color:var(--ag-crimson);")}>palette</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                  aria-label={`Edit ${p.title}`}
                  style={css('width:36px;height:36px;flex:none;border-radius:11px;border:1.5px solid var(--ag-border);background:var(--ag-surface);cursor:pointer;display:flex;align-items:center;justify-content:center;')}
                >
                  <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:18px;color:var(--ag-crimson);")}>edit</span>
                </button>
              </div>

              {/* Performance at a glance — the buyer-side signals for this piece. */}
              <div style={css('display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--ag-border-soft);')}>
                {metricsOf(p).map((m) => (
                  <span key={m.label} title={m.label} style={css('display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;color:var(--ag-ink-2);')}>
                    <span aria-hidden="true" style={css(`font-family:'Material Symbols Outlined';font-size:15px;color:${m.ic};`)}>{m.icon}</span>
                    {m.value}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* align-items:flex-start, not center: a dialog taller than the viewport
          centred inside a scroll container has its top clipped and unreachable.
          The panel is capped to the viewport and scrolls its own body, so the
          header stays put instead of the action sitting ~1300px down the page. */}
      {editing && (
        <div onClick={closeEdit} style={css('position:fixed;inset:0;z-index:50;background:rgba(42,16,25,.42);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;')}>
          <div onClick={(e) => e.stopPropagation()} style={css('width:100%;max-width:520px;margin:auto;background:var(--ag-bg);border-radius:22px;padding:18px 20px 24px;box-shadow:0 30px 80px -30px rgba(107,20,54,.6);display:flex;flex-direction:column;max-height:calc(100dvh - 40px);')}>
            <div style={css('flex:none;display:flex;align-items:center;justify-content:space-between;')}>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;")}>Edit product</div>
              <button onClick={closeEdit} style={css('width:36px;height:36px;border-radius:11px;border:none;background:var(--ag-surface);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-crimson);")}>close</span>
              </button>
            </div>

            {/* The one scroll region: form + destructive action travel together. */}
            <div style={css('flex:1;min-height:0;overflow-y:auto;margin:16px -20px -24px;padding:0 20px 24px;')}>
            <div>
              <ProductForm
                boutiqueId={editing.boutique_id}
                productId={editing.id}
                submitLabel="Save changes"
                busy={busy}
                onSubmit={save}
                // Handed the values as they stand in the form, not as they were
                // last saved, so an edit typed just before tapping the button
                // carries into the new colour instead of being lost.
                onAddColour={(values) => void addColour(editing, values)}
                onLinkColour={linkColour}
                initial={formValuesOf(editing)}
              />
            </div>

            {confirmDelete ? (
              <div style={css('margin-top:12px;background:var(--ag-bad-bg);border:1px solid var(--ag-border);border-radius:14px;padding:12px 14px;')}>
                <div style={css('font-size:13px;font-weight:700;color:var(--ag-bad-text);')}>Delete “{editing.title}”? This can't be undone.</div>
                <div style={css('display:flex;gap:10px;margin-top:10px;')}>
                  <button onClick={() => setConfirmDelete(false)} disabled={busy} style={css('flex:1;height:44px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-label);border-radius:12px;font-weight:800;cursor:pointer;')}>Cancel</button>
                  <button onClick={remove} disabled={busy} style={css(`flex:1;height:44px;border:none;background:var(--ag-danger-text);color:#fff;border-radius:12px;font-weight:800;cursor:${busy ? 'default' : 'pointer'};opacity:${busy ? 0.7 : 1};`)}>{busy ? 'Deleting…' : 'Delete'}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} disabled={busy} style={css('width:100%;height:48px;margin-top:10px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-danger-text);border-radius:14px;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;')}>
                <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>delete</span>Delete product
              </button>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
