import { useRef, useState } from 'react';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { uploadProductImage } from '@/data/products';

export type ProductFormValues = {
  title: string;
  category: string;
  color: string;
  occasion: string;
  fabric: string;
  price: string;
  stock: string;
  description: string;
  mrp: string;
  sizes: string[];
  washCare: string;
  imageUrl: string;
  images: string[];
};

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  title: '', category: '', color: '', occasion: '', fabric: '', price: '', stock: '',
  description: '', mrp: '', sizes: [], washCare: '', imageUrl: '', images: [],
};

const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'Free Size'];

const isImageUrl = (u: string) => /^https?:\/\/.+/i.test(u);

const inputStyle = 'width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:0 14px;height:50px;font-size:14px;font-weight:600;';
const inputErrStyle = 'width:100%;margin-top:6px;border:1.5px solid #E7A7B4;background:#FFF7F8;border-radius:13px;padding:0 14px;height:50px;font-size:14px;font-weight:600;';
const textAreaStyle = 'width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:12px 14px;font-size:14px;font-weight:500;font-family:inherit;resize:vertical;min-height:80px;';
const labelStyle = 'font-size:13px;font-weight:700;color:#7A5C67;';
const errStyle = 'display:block;margin-top:4px;font-size:11.5px;font-weight:700;color:#D6455A;';

type Field = { key: keyof ProductFormValues; label: string; ph: string };

const REQUIRED_FIELDS: Field[] = [
  { key: 'title', label: 'Product title *', ph: 'e.g. Rose Zari Silk Saree' },
  { key: 'category', label: 'Category *', ph: 'Sarees' },
  { key: 'color', label: 'Colour *', ph: 'Pink' },
  { key: 'occasion', label: 'Occasion *', ph: 'Wedding' },
  { key: 'fabric', label: 'Fabric *', ph: 'Kanchipuram Silk' },
];

export function ProductForm({
  boutiqueId,
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  boutiqueId: string;
  initial?: Partial<ProductFormValues>;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: ProductFormValues) => void;
}) {
  const { showToast } = useShop();
  const [form, setForm] = useState<ProductFormValues>({ ...EMPTY_PRODUCT_FORM, ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({});
  const [uploading, setUploading] = useState<'cover' | 'gallery' | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [galleryUrl, setGalleryUrl] = useState('');
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSize = (s: string) =>
    setForm((f) => ({ ...f, sizes: f.sizes.includes(s) ? f.sizes.filter((x) => x !== s) : [...f.sizes, s] }));

  const onCoverPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading('cover');
    try {
      const url = await uploadProductImage(boutiqueId, file);
      set('imageUrl', url);
      setErrors((e) => ({ ...e, imageUrl: undefined }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setUploading(null);
    }
  };

  const onGalleryPick = async (file: File | undefined) => {
    if (!file || form.images.length >= 3) return;
    setUploading('gallery');
    try {
      const url = await uploadProductImage(boutiqueId, file);
      set('images', [...form.images, url]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setUploading(null);
    }
  };

  const addCoverUrl = () => {
    const url = coverUrl.trim();
    if (!isImageUrl(url)) {
      showToast('Enter a valid image link (http/https)');
      return;
    }
    set('imageUrl', url);
    setErrors((e) => ({ ...e, imageUrl: undefined }));
    setCoverUrl('');
  };

  const addGalleryUrl = () => {
    const url = galleryUrl.trim();
    if (!isImageUrl(url)) {
      showToast('Enter a valid image link (http/https)');
      return;
    }
    if (form.images.length >= 3) {
      showToast('You can add up to 3 gallery photos');
      return;
    }
    set('images', [...form.images, url]);
    setGalleryUrl('');
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof ProductFormValues, string>> = {};
    if (!form.title.trim()) next.title = 'Required';
    if (!form.category.trim()) next.category = 'Required';
    if (!form.fabric.trim()) next.fabric = 'Required';
    if (!form.color.trim()) next.color = 'Required';
    if (!form.occasion.trim()) next.occasion = 'Required';
    if (!form.price.trim() || Number(form.price) <= 0) next.price = 'Enter a valid price';
    if (form.stock.trim() === '' || Number(form.stock) < 0) next.stock = 'Enter valid stock';
    if (!form.imageUrl) next.imageUrl = 'Add a cover photo';
    if (form.mrp.trim() && Number(form.mrp) < Number(form.price || 0)) next.mrp = 'MRP must be ≥ price';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) {
      showToast('Please fill all required fields');
      return;
    }
    onSubmit(form);
  };

  const discountPct = form.mrp.trim() && Number(form.mrp) > Number(form.price || 0)
    ? Math.round((1 - Number(form.price || 0) / Number(form.mrp)) * 100)
    : null;

  return (
    <div style={css('display:flex;flex-direction:column;gap:14px;')}>
      <div style={css('display:flex;gap:10px;')}>
        <div
          onClick={() => coverInput.current?.click()}
          style={css(`width:96px;height:96px;flex:none;border-radius:16px;border:2px dashed ${errors.imageUrl ? '#E7A7B4' : '#E6BCCF'};background:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;`)}
        >
          {form.imageUrl ? (
            <img src={form.imageUrl} alt="Cover" style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;')} />
          ) : (
            <>
              <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:24px;")}>
                {uploading === 'cover' ? 'progress_activity' : 'add_a_photo'}
              </span>
              <span style={css('font-size:10px;color:#B79AA6;font-weight:700;')}>Cover *</span>
            </>
          )}
          <input ref={coverInput} type="file" accept="image/*" style={css('display:none;')} onChange={(e) => onCoverPick(e.target.files?.[0])} />
        </div>

        {[0, 1, 2].map((i) => {
          const url = form.images[i];
          return (
            <div
              key={i}
              onClick={() => (url ? set('images', form.images.filter((x) => x !== url)) : galleryInput.current?.click())}
              style={css('width:72px;height:96px;flex:none;border-radius:16px;border:2px dashed #E6BCCF;background:#fff;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:pointer;')}
            >
              {url ? (
                <>
                  <img src={url} alt="Gallery" style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;')} />
                  <span style={css("position:absolute;top:3px;right:3px;font-family:'Material Symbols Outlined';font-size:16px;color:#fff;background:rgba(0,0,0,.45);border-radius:6px;")}>close</span>
                </>
              ) : (
                <span style={css("font-family:'Material Symbols Outlined';color:#D6A9BC;font-size:20px;")}>
                  {uploading === 'gallery' && !form.images[i] ? 'progress_activity' : 'add'}
                </span>
              )}
            </div>
          );
        })}
        <input ref={galleryInput} type="file" accept="image/*" style={css('display:none;')} onChange={(e) => onGalleryPick(e.target.files?.[0])} />
      </div>
      {errors.imageUrl && <span style={css(errStyle)}>{errors.imageUrl}</span>}

      <div style={css('background:#fff;border:1.5px solid #F0D8E2;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;')}>
        <div style={css('font-size:12.5px;font-weight:700;color:#7A5C67;')}>Or paste an image link</div>
        <div style={css('display:flex;gap:8px;')}>
          <input
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCoverUrl())}
            placeholder="Cover image URL (https://…)"
            style={css('flex:1;border:1.5px solid #F0D8E2;background:#FBF6F2;border-radius:11px;padding:0 12px;height:44px;font-size:13px;font-weight:600;')}
          />
          <button type="button" onClick={addCoverUrl} style={css('flex:none;padding:0 16px;height:44px;border:none;border-radius:11px;background:#FCE0EC;color:#B02454;font-weight:800;font-size:13px;cursor:pointer;')}>Set cover</button>
        </div>
        <div style={css('display:flex;gap:8px;')}>
          <input
            value={galleryUrl}
            onChange={(e) => setGalleryUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGalleryUrl())}
            placeholder="Gallery image URL (up to 3)"
            style={css('flex:1;border:1.5px solid #F0D8E2;background:#FBF6F2;border-radius:11px;padding:0 12px;height:44px;font-size:13px;font-weight:600;')}
          />
          <button type="button" onClick={addGalleryUrl} style={css('flex:none;padding:0 16px;height:44px;border:none;border-radius:11px;background:#FCE0EC;color:#B02454;font-weight:800;font-size:13px;cursor:pointer;')}>Add photo</button>
        </div>
      </div>

      {REQUIRED_FIELDS.map((fl) => (
        <label key={fl.key} style={css(labelStyle)}>
          {fl.label}
          <input
            value={form[fl.key] as string}
            onChange={(e) => set(fl.key, e.target.value as never)}
            placeholder={fl.ph}
            style={css(errors[fl.key] ? inputErrStyle : inputStyle)}
          />
          {errors[fl.key] && <span style={css(errStyle)}>{errors[fl.key]}</span>}
        </label>
      ))}

      <div style={css('display:flex;gap:12px;')}>
        <label style={css(`flex:1;${labelStyle}`)}>
          Price (₹) *<input value={form.price} onChange={(e) => set('price', e.target.value)} inputMode="numeric" placeholder="4899" style={css(errors.price ? inputErrStyle : inputStyle)} />
          {errors.price && <span style={css(errStyle)}>{errors.price}</span>}
        </label>
        <label style={css(`flex:1;${labelStyle}`)}>
          Stock *<input value={form.stock} onChange={(e) => set('stock', e.target.value)} inputMode="numeric" placeholder="12" style={css(errors.stock ? inputErrStyle : inputStyle)} />
          {errors.stock && <span style={css(errStyle)}>{errors.stock}</span>}
        </label>
      </div>

      <label style={css(labelStyle)}>
        MRP (₹) — optional, shows a discount badge to buyers
        <input value={form.mrp} onChange={(e) => set('mrp', e.target.value)} inputMode="numeric" placeholder="5999" style={css(errors.mrp ? inputErrStyle : inputStyle)} />
        {errors.mrp && <span style={css(errStyle)}>{errors.mrp}</span>}
        {discountPct != null && <span style={css('display:block;margin-top:4px;font-size:11.5px;font-weight:700;color:#2FA36B;')}>{discountPct}% off badge will show to buyers</span>}
      </label>

      <div>
        <div style={css(labelStyle)}>Sizes available — optional</div>
        <div style={css('display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;')}>
          {SIZE_OPTIONS.map((s) => {
            const on = form.sizes.includes(s);
            return (
              <span key={s} onClick={() => toggleSize(s)} style={css(`padding:9px 14px;border-radius:11px;border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : '#fff'};color:${on ? '#B02454' : '#4B3840'};font-weight:700;font-size:13px;cursor:pointer;`)}>{s}</span>
            );
          })}
        </div>
      </div>

      <label style={css(labelStyle)}>
        Description — optional
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Handcrafted with intricate zari work, tailored for a graceful drape…" style={css(textAreaStyle)} />
      </label>

      <label style={css(labelStyle)}>
        Wash care — optional
        <textarea value={form.washCare} onChange={(e) => set('washCare', e.target.value)} placeholder="Dry clean only" style={css(textAreaStyle)} />
      </label>

      <button
        onClick={submit}
        disabled={busy || uploading != null}
        style={css(`width:100%;height:54px;border:none;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:${busy || uploading ? 'default' : 'pointer'};opacity:${busy || uploading ? 0.7 : 1};box-shadow:0 14px 30px -14px rgba(214,51,108,.8);`)}
      >
        {uploading ? 'Uploading photo…' : busy ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}
