import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useShop } from '@/state/ShopContext';
import { fetchProductsByBoutique } from '@/data/products';
import { createPost, fetchPost, updatePost, uploadPostImage, type PostInput } from '@/data/posts';
import type { ProductWithBoutique } from '@/data/types';
import { fmtInr } from '@/lib/tokens';

const MAX_PHOTOS = 6;
const CTA_PRESETS = ['Shop Collection', 'Shop the Look', 'Shop Now', 'View Details', 'Enquire'];

/**
 * Create or edit an Inspire post. One component for both — `/seller/posts/new`
 * and `/seller/posts/:id` differ only in whether there's an existing row to load
 * and whether saving inserts or updates.
 */
export function PostEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { boutique, loading: boutiqueLoading } = useMyBoutique();
  const { showToast } = useShop();

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [productId, setProductId] = useState('');
  const [category, setCategory] = useState('');
  const [ctaLabel, setCtaLabel] = useState(CTA_PRESETS[0]);
  const [status, setStatus] = useState<'published' | 'hidden'>('published');

  const [products, setProducts] = useState<ProductWithBoutique[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Existing post, when editing.
  useEffect(() => {
    if (isNew || !id) return;
    let active = true;
    fetchPost(id)
      .then((p) => {
        if (!active || !p) return;
        setTitle(p.title);
        setCaption(p.caption);
        setImages(p.images ?? []);
        setProductId(p.product_id ?? '');
        setCategory(p.category ?? '');
        setCtaLabel(p.cta_label || CTA_PRESETS[0]);
        setStatus(p.status);
      })
      .catch(() => showToast("Couldn't load that post"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, isNew, showToast]);

  // The shop's own catalogue, so the call to action can point at a real piece.
  useEffect(() => {
    if (!boutique?.id) return;
    let active = true;
    fetchProductsByBoutique(boutique.id)
      .then((rows) => { if (active) setProducts(rows); })
      .catch(() => { /* the post can still be published without a linked product */ });
    return () => { active = false; };
  }, [boutique?.id]);

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length || !boutique?.id) return;
    const room = MAX_PHOTOS - images.length;
    if (room <= 0) {
      showToast(`A post can hold ${MAX_PHOTOS} photos`);
      return;
    }
    setUploading(true);
    try {
      // Sequential rather than parallel: a seller on a phone connection gets a
      // clearer failure and doesn't saturate the uplink with six uploads.
      for (const file of Array.from(files).slice(0, room)) {
        const url = await uploadPostImage(boutique.id, file);
        setImages((prev) => [...prev, url]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const move = (from: number, delta: number) => {
    setImages((prev) => {
      const to = from + delta;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const removeImage = (i: number) => setImages((prev) => prev.filter((_, x) => x !== i));

  const save = async (nextStatus?: 'published' | 'hidden') => {
    if (!boutique?.id) {
      showToast('Set up your boutique first');
      return;
    }
    if (!title.trim() && !caption.trim()) {
      showToast('Add a title or a caption');
      return;
    }
    if (images.length === 0) {
      showToast('Add at least one photo');
      return;
    }
    const payload: PostInput = {
      title: title.trim(),
      caption: caption.trim(),
      images,
      product_id: productId || null,
      // A linked product already decides where the button goes, so a category
      // alongside it would be dead data.
      category: productId ? null : category || null,
      cta_label: ctaLabel.trim() || 'Shop Collection',
      status: nextStatus ?? status,
    };
    setSaving(true);
    try {
      if (isNew) await createPost(boutique.id, payload);
      else await updatePost(id!, payload);
      showToast(payload.status === 'published' ? 'Post is live in the feed' : 'Saved as hidden');
      navigate('/seller/posts');
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't save the post");
    } finally {
      setSaving(false);
    }
  };

  const label = (text: string) => (
    <div className="agx-eyebrow" style={css('font-size:9.5px;color:#8A7078;margin-bottom:8px;')}>{text}</div>
  );
  const fieldCss = 'display:block;width:100%;border:1.5px solid #F0D8E2;background:#FBF6F2;border-radius:14px;padding:0 15px;height:52px;font-size:15px;font-weight:600;color:#241019;';
  const card = 'background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:18px;box-shadow:0 16px 36px -32px rgba(107,20,54,.55);';

  if (loading || boutiqueLoading) {
    return (
      <div style={css('min-height:50vh;display:flex;align-items:center;justify-content:center;color:#8A7078;font-size:14px;')}>
        Loading…
      </div>
    );
  }

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:760px;margin:0 auto;')}>
        <button onClick={() => navigate('/seller/posts')} style={css('border:none;background:none;cursor:pointer;color:#B02454;font-weight:800;font-size:13.5px;display:flex;align-items:center;gap:6px;padding:6px 0;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>arrow_back</span>Posts
        </button>

        <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Inspire feed</div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(26px,3vw,36px);line-height:1.05;margin-top:4px;")}>
          {isNew ? 'New post' : 'Edit post'}
        </div>

        {/* ── Photos ── */}
        <div style={css(`${card}margin-top:18px;`)}>
          {label(`Photos · ${images.length}/${MAX_PHOTOS}`)}
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;')}>
            {images.map((src, i) => (
              <div key={`${src}-${i}`} style={css('position:relative;')}>
                <div className="agx-thumb-media" style={css('width:100%;background:#F4E6EC;')}>
                  <ImageSlot src={src} placeholder={`Photo ${i + 1}`} className="agx-prod-fill" />
                </div>
                {i === 0 && (
                  <span style={css('position:absolute;left:6px;top:6px;background:rgba(36,16,25,.65);color:#fff;font-size:9px;font-weight:800;padding:3px 7px;border-radius:999px;')}>
                    Cover
                  </span>
                )}
                <button
                  onClick={() => removeImage(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  style={css('position:absolute;right:6px;top:6px;width:26px;height:26px;border:none;border-radius:9px;background:rgba(255,255,255,.94);color:#C0455E;cursor:pointer;display:flex;align-items:center;justify-content:center;')}
                >
                  <span style={css("font-family:'Material Symbols Outlined';font-size:16px;")}>close</span>
                </button>
                <div style={css('display:flex;gap:5px;margin-top:6px;')}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" style={css(`flex:1;height:26px;border:1px solid #F0D8E2;background:#fff;border-radius:8px;cursor:pointer;color:#B02454;opacity:${i === 0 ? 0.4 : 1};display:flex;align-items:center;justify-content:center;`)}>
                    <span style={css("font-family:'Material Symbols Outlined';font-size:15px;")}>chevron_left</span>
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move later" style={css(`flex:1;height:26px;border:1px solid #F0D8E2;background:#fff;border-radius:8px;cursor:pointer;color:#B02454;opacity:${i === images.length - 1 ? 0.4 : 1};display:flex;align-items:center;justify-content:center;`)}>
                    <span style={css("font-family:'Material Symbols Outlined';font-size:15px;")}>chevron_right</span>
                  </button>
                </div>
              </div>
            ))}

            {images.length < MAX_PHOTOS && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={css(`aspect-ratio:3/4;border:1.5px dashed #E7B7CB;background:#FCF3F7;border-radius:13px;cursor:${uploading ? 'wait' : 'pointer'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#B02454;font-weight:800;font-size:12px;`)}
              >
                <span style={css("font-family:'Material Symbols Outlined';font-size:26px;")}>{uploading ? 'sync' : 'add_photo_alternate'}</span>
                {uploading ? 'Uploading…' : 'Add photo'}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void onPickFiles(e.target.files)}
            style={css('display:none;')}
          />
          <div style={css('font-size:11.5px;color:#B79AA6;margin-top:10px;line-height:1.5;')}>
            The first photo is the cover buyers see first. Portrait shots (3:4) fill the feed card best.
          </div>
        </div>

        {/* ── Copy ── */}
        <div style={css(`${card}margin-top:14px;`)}>
          {label('Title')}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Wedding Collection 2026"
            style={css(fieldCss)}
          />
          <div style={css('height:16px;')} />
          {label('Caption')}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Pure kanchipuram silk sarees in new shades"
            style={css('display:block;width:100%;border:1.5px solid #F0D8E2;background:#FBF6F2;border-radius:14px;padding:12px 15px;font-size:15px;font-weight:600;color:#241019;resize:none;line-height:1.5;')}
          />
          <div style={css('font-size:11.5px;color:#B79AA6;margin-top:6px;text-align:right;')}>{caption.length}/280</div>
        </div>

        {/* ── Call to action ── */}
        <div style={css(`${card}margin-top:14px;`)}>
          {label('Where the button goes')}
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            style={css(`${fieldCss}appearance:auto;`)}
          >
            <option value="">A collection, not one piece</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title} · {fmtInr(Number(p.price))}</option>
            ))}
          </select>

          {!productId && categories.length > 0 && (
            <>
              <div style={css('height:14px;')} />
              <div style={css('display:flex;flex-wrap:wrap;gap:8px;')}>
                <button
                  onClick={() => setCategory('')}
                  style={css(`border:1.5px solid ${!category ? '#D6336C' : '#F0D8E2'};background:${!category ? '#FCE0EC' : '#fff'};color:${!category ? '#B02454' : '#6B5560'};border-radius:999px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer;`)}
                >
                  My whole shop
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    style={css(`border:1.5px solid ${category === c ? '#D6336C' : '#F0D8E2'};background:${category === c ? '#FCE0EC' : '#fff'};color:${category === c ? '#B02454' : '#6B5560'};border-radius:999px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer;`)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={css('height:18px;')} />
          {label('Button text')}
          <div style={css('display:flex;flex-wrap:wrap;gap:8px;')}>
            {CTA_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setCtaLabel(c)}
                style={css(`border:1.5px solid ${ctaLabel === c ? '#D6336C' : '#F0D8E2'};background:${ctaLabel === c ? '#FCE0EC' : '#fff'};color:${ctaLabel === c ? '#B02454' : '#6B5560'};border-radius:999px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer;`)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── Save ── */}
        <div style={css('display:flex;gap:11px;margin-top:18px;flex-wrap:wrap;')}>
          <button
            onClick={() => void save('published')}
            disabled={saving || uploading}
            style={css(`flex:2;min-width:180px;height:54px;border:none;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:15px;cursor:${saving ? 'wait' : 'pointer'};opacity:${saving || uploading ? 0.7 : 1};display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);`)}
          >
            <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>send</span>
            {saving ? 'Saving…' : isNew ? 'Publish to feed' : 'Save & publish'}
          </button>
          <button
            onClick={() => void save('hidden')}
            disabled={saving || uploading}
            style={css('flex:1;min-width:130px;height:54px;border:1.5px solid #F0D8E2;background:#fff;color:#B02454;border-radius:15px;font-weight:800;font-size:14px;cursor:pointer;')}
          >
            Save as hidden
          </button>
        </div>
      </div>
    </div>
  );
}
