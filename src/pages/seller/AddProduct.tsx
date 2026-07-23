import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { createProduct } from '@/data/products';
import { ProductForm, type ProductFormValues } from '@/components/seller/ProductForm';

export function AddProduct() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutique } = useMyBoutique();
  const [saving, setSaving] = useState(false);

  const publish = async (form: ProductFormValues) => {
    if (!boutique) {
      showToast('No boutique found for this account');
      return;
    }
    setSaving(true);
    try {
      await createProduct({
        boutique_id: boutique.id,
        title: form.title.trim(),
        category: form.category.trim() || 'Other',
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        fabric: form.fabric.trim(),
        color: form.color.trim(),
        occasion: form.occasion.trim(),
        tone: Math.floor(Math.random() * 8),
        description: form.description.trim(),
        mrp: form.mrp.trim() ? Number(form.mrp) : null,
        sizes: form.sizes,
        wash_care: form.washCare.trim(),
        image_url: form.imageUrl,
        images: form.images,
        music_url: form.musicUrl || null,
        music_title: form.musicUrl ? form.musicTitle.trim() || 'Original audio' : null,
      });
      showToast('Product published');
      navigate('/seller/products');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not publish product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:24px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/products')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>Add New Product</div>
      </div>

      <div style={css('padding:6px 20px 0;')}>
        {boutique ? (
          <ProductForm boutiqueId={boutique.id} submitLabel="Publish Product" busy={saving} onSubmit={publish} />
        ) : (
          <div style={css('color:#8A7078;font-size:14px;padding:20px 2px;')}>Loading your boutique…</div>
        )}
      </div>
    </div>
  );
}
