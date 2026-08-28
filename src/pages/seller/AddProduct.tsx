import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { createProduct } from '@/data/products';
import { ProductForm, readSizeStock, type ProductFormValues } from '@/components/seller/ProductForm';

/** What "Add another colour" hands this page: every field of the piece being
 *  copied except the two that must differ. See MyProducts. */
type AddProductState = { prefill?: Partial<ProductFormValues> } | null;

export function AddProduct() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutique } = useMyBoutique();
  const [saving, setSaving] = useState(false);
  // Arrives only from "Add another colour"; a plain Add starts empty.
  const prefill = (useLocation().state as AddProductState)?.prefill;
  const anotherColour = !!prefill?.variantGroupId;

  const publish = async (form: ProductFormValues) => {
    if (!boutique) {
      showToast('No boutique found for this account');
      return;
    }
    setSaving(true);
    try {
      const { size_stock, stock } = readSizeStock(form);
      await createProduct({
        boutique_id: boutique.id,
        title: form.title.trim(),
        category: form.category.trim() || 'Other',
        price: Number(form.price) || 0,
        stock,
        size_stock,
        variant_group_id: form.variantGroupId || null,
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
      });
      showToast(anotherColour ? 'Colour added to the set' : 'Product published');
      navigate('/seller/products');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not publish product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={css('min-height:100%;background:var(--ag-bg);padding-bottom:24px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/products')} aria-label="Go back" style={css('width:42px;height:42px;border-radius:12px;border:none;background:var(--ag-surface);box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-crimson);")}>arrow_back</span>
        </button>
        <h1 style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>
          {anotherColour ? 'Add Another Colour' : 'Add New Product'}
        </h1>
      </div>

      {/* Everything came across except the two things that have to differ, so
          the seller only fills in what is genuinely new about this colour. */}
      {anotherColour && (
        <div style={css('margin:0 20px 12px;background:var(--ag-info-bg);border:1px solid var(--ag-border);border-radius:16px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;')}>
          <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:20px;color:var(--ag-info-text);")}>palette</span>
          <span style={css('font-size:12px;font-weight:700;color:var(--ag-info-text);line-height:1.5;')}>
            Copied from “{prefill?.title}”. Pick this colour and upload its own photos — the price and
            stock came across too, so change them if this colour differs.
          </span>
        </div>
      )}

      <div style={css('padding:6px 20px 0;')}>
        {boutique ? (
          <ProductForm
            boutiqueId={boutique.id}
            initial={prefill}
            submitLabel={anotherColour ? 'Publish This Colour' : 'Publish Product'}
            busy={saving}
            onSubmit={publish}
          />
        ) : (
          <div style={css('color:var(--ag-muted);font-size:14px;padding:20px 2px;')}>Loading your boutique…</div>
        )}
      </div>
    </div>
  );
}
