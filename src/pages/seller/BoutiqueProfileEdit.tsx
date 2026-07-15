import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { updateBoutique } from '@/data/boutiques';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { Input, TextArea } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function BoutiqueProfileEdit() {
  const navigate = useNavigate();
  const toast = useToast();
  const { boutique, reload } = useMyBoutique();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (boutique) {
      setName(boutique.name);
      setCity(boutique.city);
      setDescription(boutique.description);
    }
  }, [boutique]);

  if (!boutique) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await updateBoutique(boutique!.id, { name, city, description });
      toast('Boutique updated');
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-rose-card pb-6">
      <ScreenHeader title="Boutique Profile" onBack={() => navigate('/seller/profile')} size={23} />
      <div className="px-5">
        <div className="relative flex h-[110px] items-center justify-center overflow-hidden rounded-2xl bg-rose-chip">
          <span className="rounded-lg bg-white/70 px-2.5 py-1 font-mono text-[11px] text-black/50">cover image · tap to change</span>
        </div>
        <div className="relative -mt-6 flex items-center gap-3 pl-1.5">
          <div className="flex h-[70px] w-[70px] items-center justify-center rounded-[20px] border-[3px] border-rose-card bg-[#E2DAEF] font-serif text-[28px] font-bold text-black/50">
            {boutique.name[0]}
          </div>
          {boutique.verified && (
            <div className="mt-6 flex items-center gap-1.5 rounded-lg bg-good/10 px-2.5 py-1.5 text-xs font-extrabold text-good" style={{ background: '#E5F3EC' }}>
              <Icon name="verified" className="text-base" />
              Verified
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3.5">
          <label className="text-[13px] font-bold text-rose-fieldLabel">
            Boutique name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </label>
          <label className="text-[13px] font-bold text-rose-fieldLabel">
            City
            <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5" />
          </label>
          <label className="text-[13px] font-bold text-rose-fieldLabel">
            Description
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5" />
          </label>
          <Button full onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
