import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useTaxonomy } from '@/state/TaxonomyContext';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { createProducts } from '@/data/products';
import {
  EMPTY_PRODUCT_FORM, ProductForm, cleanProductForm, readSizeStock, validateProductForm,
  type ProductFormValues,
} from '@/components/seller/ProductForm';

/** What "Add another colour" on the catalogue row hands this page: every field
 *  of the piece being copied except the two that must differ. See MyProducts. */
type AddProductState = { prefill?: Partial<ProductFormValues> } | null;

type FormErrors = Partial<Record<keyof ProductFormValues, string>>;

/** One colour being written alongside the main piece. `key` is a stable React
 *  key — the colour itself can't be one, since it starts empty and two colours
 *  are both '' until they're picked. */
type ExtraColour = { key: string; values: ProductFormValues };

export function AddProduct() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const taxonomy = useTaxonomy();
  const { boutique } = useMyBoutique();
  const [saving, setSaving] = useState(false);
  // Arrives from the catalogue's "Add another colour"; a plain Add starts empty.
  const prefill = (useLocation().state as AddProductState)?.prefill;
  const joiningSet = !!prefill?.variantGroupId;

  const [main, setMain] = useState<ProductFormValues>({ ...EMPTY_PRODUCT_FORM, ...prefill });
  const [extras, setExtras] = useState<ExtraColour[]>([]);
  // Which colour card is open. Only one at a time: a full product form per
  // colour, all expanded, would be an unreadable page.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, FormErrors>>({});
  // Every form that currently has a photo in flight. Publishing mid-upload
  // would write a product missing the photo that hadn't landed yet.
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const anyUploading = Object.values(uploading).some(Boolean);

  const setUploadingFor = (key: string, v: boolean) =>
    setUploading((u) => (!!u[key] === v ? u : { ...u, [key]: v }));

  /**
   * A new colour starts as a copy of the piece as it stands — everything except
   * the colour itself and the photos, which have to show the actual garment in
   * that colour or the buyer's swatch lies about what arrives. Every other
   * field is still editable per colour; it just isn't retyped.
   */
  const addColour = () => {
    const key = crypto.randomUUID();
    setExtras((xs) => [...xs, { key, values: { ...main, color: '', imageUrl: '', images: [] } }]);
    setOpenKey(key);
  };

  const removeColour = (key: string) => {
    setExtras((xs) => xs.filter((x) => x.key !== key));
    setErrors((e) => { const { [key]: _gone, ...rest } = e; return rest; });
    setUploading((u) => { const { [key]: _gone, ...rest } = u; return rest; });
    if (openKey === key) setOpenKey(null);
  };

  /**
   * Errors live up here because Publish does, so they have to be kept honest
   * from up here too — re-checked on every keystroke, but only for a form that
   * has already been refused once. Clearing the whole card instead would hide
   * "still needs a cover photo" the moment the seller touched the title.
   */
  const revalidate = (key: string, values: ProductFormValues) =>
    setErrors((e) => (e[key] ? { ...e, [key]: validateProductForm(values, (c) => taxonomy.isApproved('color', c)) } : e));

  const setMainValues = (values: ProductFormValues) => {
    setMain(values);
    revalidate('main', values);
  };

  const setExtraValues = (key: string, values: ProductFormValues) => {
    setExtras((xs) => xs.map((x) => (x.key === key ? { ...x, values } : x)));
    revalidate(key, values);
  };

  const rowFor = (form: ProductFormValues, boutiqueId: string, groupId: string | null) => {
    const { size_stock, stock } = readSizeStock(form);
    return {
      boutique_id: boutiqueId,
      title: form.title.trim(),
      category: form.category.trim() || 'Other',
      price: Number(form.price) || 0,
      stock,
      size_stock,
      variant_group_id: groupId,
      fabric: form.fabric.trim(),
      color: form.color.trim(),
      occasion: form.occasion.trim(),
      tone: Math.floor(Math.random() * 8),
      description: form.description.trim(),
      mrp: form.mrp.trim() ? Number(form.mrp) : null,
      weight_grams: form.weightGrams.trim() ? Number(form.weightGrams) : null,
      sizes: form.sizes,
      wash_care: form.washCare.trim(),
      image_url: form.imageUrl,
      images: form.images,
      badges: form.badges,
      feeding_friendly: form.feedingFriendly,
      // A note only means anything alongside the flag — clear it when the
      // seller turns feeding-friendly off, so it can't resurface later.
      feeding_note: form.feedingFriendly ? form.feedingNote.trim() : '',
      shipping_info: form.shippingInfo.trim(),
      color_disclaimer: form.colorDisclaimer.trim(),
      specs: form.specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
    };
  };

  const publish = async () => {
    if (!boutique) {
      showToast('No boutique found for this account');
      return;
    }

    // Check every colour before writing any of them: the seller finds out about
    // a missing photo on colour three now, not after two are already live.
    const isApproved = (c: string) => taxonomy.isApproved('color', c);
    const forms: [string, ProductFormValues][] = [['main', main], ...extras.map((x): [string, ProductFormValues] => [x.key, x.values])];
    const found: Record<string, FormErrors> = {};
    for (const [key, values] of forms) {
      const e = validateProductForm(values, isApproved);
      if (Object.keys(e).length) found[key] = e;
    }
    setErrors(found);
    const firstBad = forms.find(([key]) => found[key])?.[0];
    if (firstBad) {
      // Open the colour that's short of something, or nothing explains the
      // refusal — the card hiding the error may well be collapsed.
      if (firstBad !== 'main') setOpenKey(firstBad);
      showToast(firstBad === 'main' ? 'Please fill all required fields' : 'One of the colours needs a bit more');
      return;
    }

    // A set only exists once there is more than one colour in it. Arriving from
    // the catalogue's "Add another colour" means the id is already decided.
    const groupId = extras.length > 0 ? (main.variantGroupId || crypto.randomUUID()) : (main.variantGroupId || null);

    setSaving(true);
    try {
      await createProducts(forms.map(([, v]) => rowFor(cleanProductForm(v), boutique.id, groupId)));
      showToast(
        extras.length > 0 ? `${forms.length} colours published`
          : joiningSet ? 'Colour added to the set'
            : 'Product published',
      );
      navigate('/seller/products');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not publish product');
    } finally {
      setSaving(false);
    }
  };

  const publishLabel = anyUploading ? 'Uploading photo…'
    : saving ? 'Publishing…'
      : extras.length > 0 ? `Publish ${extras.length + 1} Colours`
        : joiningSet ? 'Publish This Colour'
          : 'Publish Product';

  return (
    <div style={css('min-height:100%;background:var(--ag-bg);padding-bottom:24px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/products')} aria-label="Go back" style={css('width:42px;height:42px;border-radius:12px;border:none;background:var(--ag-surface);box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-crimson);")}>arrow_back</span>
        </button>
        <h1 style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>
          {joiningSet ? 'Add Another Colour' : 'Add New Product'}
        </h1>
      </div>

      {/* Everything came across except the two things that have to differ, so
          the seller only fills in what is genuinely new about this colour. */}
      {joiningSet && (
        <div style={css('margin:0 20px 12px;background:var(--ag-info-bg);border:1px solid var(--ag-border);border-radius:16px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;')}>
          <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:20px;color:var(--ag-info-text);")}>palette</span>
          <span style={css('font-size:12px;font-weight:700;color:var(--ag-info-text);line-height:1.5;')}>
            Copied from “{prefill?.title}”. Pick this colour and upload its own photos — the price and
            stock came across too, so change them if this colour differs.
          </span>
        </div>
      )}

      <div style={css('padding:6px 20px 0;')}>
        {!boutique ? (
          <div style={css('color:var(--ag-muted);font-size:14px;padding:20px 2px;')}>Loading your boutique…</div>
        ) : (
          <div style={css('display:flex;flex-direction:column;gap:14px;')}>
            <ProductForm
              boutiqueId={boutique.id}
              busy={saving}
              embedded
              value={main}
              onChange={setMainValues}
              errors={errors.main}
              onUploadingChange={(v) => setUploadingFor('main', v)}
            />

            {/* ── The same piece in its other colours ─────────────────────────
                Each one publishes as its own product — its own photos, price,
                stock, page and reviews — tied to the others by a shared set id
                (migration 0103). They are written together in a single
                statement, so a shop listing a four-colour run does it in one
                pass instead of four, and never ends up with half a set live. */}
            <div style={css('border:1.5px solid var(--ag-border);border-radius:16px;background:var(--ag-surface);padding:13px 14px;')}>
              <div style={css('display:flex;align-items:center;gap:9px;')}>
                <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:19px;color:var(--ag-crimson);")}>palette</span>
                <div style={css('flex:1;min-width:0;')}>
                  <div style={css('font-size:13.5px;font-weight:800;color:var(--ag-ink);')}>Other colours of this piece</div>
                  <div style={css('font-size:11.5px;font-weight:600;color:var(--ag-muted);line-height:1.45;')}>
                    Stitch this in more than one colour? Add each one here and they publish together.
                    Buyers get swatches to switch between them, and every colour keeps its own photos,
                    price and stock.
                  </div>
                </div>
              </div>

              {extras.length > 0 && (
                <div style={css('display:flex;flex-direction:column;gap:9px;margin-top:12px;')}>
                  {extras.map((x, i) => {
                    const open = openKey === x.key;
                    const bad = !!errors[x.key];
                    return (
                      <div key={x.key} style={css(`border:1.5px solid ${bad ? 'var(--ag-danger-text)' : 'var(--ag-border)'};border-radius:14px;background:var(--ag-bg);overflow:hidden;`)}>
                        <div style={css('display:flex;align-items:center;gap:9px;padding:9px 11px;')}>
                          <button
                            type="button"
                            onClick={() => setOpenKey(open ? null : x.key)}
                            aria-expanded={open}
                            style={css('flex:1;min-width:0;display:flex;align-items:center;gap:9px;border:none;background:none;padding:0;font-family:inherit;cursor:pointer;text-align:left;')}
                          >
                            <span style={css(`width:34px;height:34px;flex:none;border-radius:10px;border:1.5px solid var(--ag-border);background:${x.values.imageUrl ? `center/cover url(${JSON.stringify(x.values.imageUrl)})` : 'var(--ag-surface-2)'};`)} />
                            <span style={css('flex:1;min-width:0;')}>
                              <span style={css('display:block;font-size:12.5px;font-weight:800;color:var(--ag-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>
                                {x.values.color || `Colour ${i + 2}`}
                              </span>
                              <span style={css(`display:block;font-size:11px;font-weight:700;color:${bad ? 'var(--ag-danger-text)' : 'var(--ag-muted)'};`)}>
                                {bad ? 'Needs a bit more' : open ? 'Tap to collapse' : 'Tap to fill in'}
                              </span>
                            </span>
                            <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:20px;color:var(--ag-muted);")}>
                              {open ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeColour(x.key)}
                            aria-label={`Remove ${x.values.color || `colour ${i + 2}`}`}
                            style={css('width:34px;height:34px;flex:none;border-radius:10px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-danger-text);cursor:pointer;display:flex;align-items:center;justify-content:center;')}
                          >
                            <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>delete</span>
                          </button>
                        </div>

                        {/* Mounted only while open: each one is a whole product
                            form, and four of them live at once is a lot of DOM
                            for a phone. Its values live up here, so collapsing
                            a card never loses what was typed into it. */}
                        {open && (
                          <div style={css('padding:2px 11px 13px;')}>
                            <ProductForm
                              boutiqueId={boutique.id}
                              busy={saving}
                              embedded
                              value={x.values}
                              onChange={(v) => setExtraValues(x.key, v)}
                              errors={errors[x.key]}
                              onUploadingChange={(v) => setUploadingFor(x.key, v)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={addColour}
                style={css('width:100%;height:46px;margin-top:12px;border:1.5px dashed var(--ag-border);border-radius:13px;background:var(--ag-surface);color:var(--ag-crimson);font-weight:800;font-size:13px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;')}
              >
                <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>add</span>
                Add another colour
              </button>
            </div>

            <button
              onClick={() => void publish()}
              disabled={saving || anyUploading}
              style={css(`width:100%;height:54px;border:none;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:${saving || anyUploading ? 'default' : 'pointer'};opacity:${saving || anyUploading ? 0.7 : 1};box-shadow:0 14px 30px -14px rgba(214,51,108,.8);`)}
            >
              {publishLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
