import { useState } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { fetchAds, createAd } from '@/data/ads';
import { Icon } from '@/components/ui/Icon';
import { statusStyle } from '@/lib/tokens';
import { useToast } from '@/components/ui/Toast';

export function Ads() {
  const { data: ads, reload } = useAsync(fetchAds, []);
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  async function handleNew() {
    setCreating(true);
    try {
      await createAd('New campaign', 'Home hero · Buyer app');
      toast('New campaign draft created');
      reload();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <button
          onClick={handleNew}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-xl border-none px-4.5 py-2.5 text-[13px] font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
        >
          <Icon name="add" className="text-lg" />
          New campaign
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(ads ?? []).map((ad) => {
          const st = statusStyle(ad.status.charAt(0).toUpperCase() + ad.status.slice(1));
          return (
            <div key={ad.id} className="flex overflow-hidden rounded-[18px] bg-white shadow-soft">
              <div className="w-[120px] flex-none" style={{ background: 'linear-gradient(150deg,#D6336C,#B02454)' }} />
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold">{ad.title}</span>
                  <span className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold capitalize" style={{ background: st.bg, color: st.fg }}>
                    {ad.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-rose-muted">{ad.placement}</div>
                <div className="mt-3 flex gap-5">
                  <div>
                    <div className="font-serif text-xl font-bold leading-none">{ad.impressions.toLocaleString('en-IN') || '—'}</div>
                    <div className="text-[11px] text-rose-mutedSoft">impressions</div>
                  </div>
                  <div>
                    <div className="font-serif text-xl font-bold leading-none">{ad.clicks.toLocaleString('en-IN') || '—'}</div>
                    <div className="text-[11px] text-rose-mutedSoft">clicks</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {ads?.length === 0 && <div className="col-span-2 py-8 text-center text-sm text-rose-muted">No campaigns yet.</div>}
      </div>
    </div>
  );
}
