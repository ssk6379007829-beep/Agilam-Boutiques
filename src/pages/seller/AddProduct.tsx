import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { createProduct } from '@/data/products';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { Input, TextArea } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function AddProduct() {
  const navigate = useNavigate();
  const toast = useToast();
  const { boutique } = useMyBoutique();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Sarees');
  const [color, setColor] = useState('');
  const [occasion, setOccasion] = useState('');
  const [fabric, setFabric] = useState('');
  const [price, setPrice] = useState('4899');
  const [stock, setStock] = useState('12');
  const [description, setDescription] = useState('Handcrafted Kanchipuram silk saree with intricate zari border.');
  const [saving, setSaving] = useState(false);

  async function handlePublish() {
    if (!boutique) return;
    if (!title.trim()) return toast('Enter a product title');
    setSaving(true);
    try {
      await createProduct({
        boutique_id: boutique.id,
        title: title.trim(),
        category,
        color,
        occasion,
        fabric,
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        tone: Math.floor(Math.random() * 8),
      });
      toast('Product published');
      navigate('/seller/products');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not publish product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-rose-card pb-6">
      <ScreenHeader title="Add New Product" onBack={() => navigate('/seller/products')} size={24} />
      <div className="flex flex-col gap-3.5 px-5">
        <div className="flex gap-2.5">
          <div className="flex h-24 w-24 flex-none flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#E6BCCF] bg-white">
            <Icon name="add_a_photo" className="text-2xl" style={{ color: '#D6336C' }} />
            <span className="text-[10px] font-bold text-rose-mutedSoft">Upload</span>
          </div>
          <div className="relative h-24 flex-1 overflow-hidden rounded-2xl bg-rose-chip">
            <div className="absolute bottom-1.5 left-2 font-mono text-[9px] text-black/40">product photo</div>
          </div>
        </div>

        <label className="text-[13px] font-bold text-rose-fieldLabel">
          Product title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" placeholder="e.g. Rose Zari Silk Saree" />
        </label>
        <label className="text-[13px] font-bold text-rose-fieldLabel">
          Category
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5" />
        </label>
        <label className="text-[13px] font-bold text-rose-fieldLabel">
          Colour
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="mt-1.5" placeholder="Pink" />
        </label>
        <label className="text-[13px] font-bold text-rose-fieldLabel">
          Occasion
          <Input value={occasion} onChange={(e) => setOccasion(e.target.value)} className="mt-1.5" placeholder="Wedding" />
        </label>
        <label className="text-[13px] font-bold text-rose-fieldLabel">
          Fabric
          <Input value={fabric} onChange={(e) => setFabric(e.target.value)} className="mt-1.5" placeholder="Kanchipuram Silk" />
        </label>

        <div className="flex gap-3">
          <label className="flex-1 text-[13px] font-bold text-rose-fieldLabel">
            Price (₹)
            <Input value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1.5" type="number" />
          </label>
          <label className="flex-1 text-[13px] font-bold text-rose-fieldLabel">
            Stock
            <Input value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1.5" type="number" />
          </label>
        </div>

        <label className="text-[13px] font-bold text-rose-fieldLabel">
          Description
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5" />
        </label>

        <Button full onClick={handlePublish} disabled={saving} className="mt-1">
          {saving ? 'Publishing…' : 'Publish Product'}
        </Button>
      </div>
    </div>
  );
}
