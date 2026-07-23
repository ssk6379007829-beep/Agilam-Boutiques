import { useState } from 'react';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchAds, createAd, updateAd, setAdStatus, deleteAd, type AdRow } from '@/data/ads';
import type { AdStatus } from '@/types/database';

const STATUS_STYLE: Record<AdStatus, { label: string; bg: string; fg: string }> = {
  live: { label: 'Live', bg: '#E5F3EC', fg: '#218456' },
  paused: { label: 'Paused', bg: '#F1E4EB', fg: '#8A7078' },
  draft: { label: 'Draft', bg: '#FBF0DA', fg: '#B8860B' },
};
const STATUSES: AdStatus[] = ['draft', 'live', 'paused'];
const compact = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));

type Draft = { id: string | null; title: string; placement: string; status: AdStatus };
const EMPTY: Draft = { id: null, title: '', placement: '', status: 'draft' };

const field = 'width:100%;margin-top:6px;border:1.5px solid #F0D8E2;background:#fff;border-radius:12px;padding:0 14px;height:46px;font-size:14px;font-weight:600;color:#2A1A20;font-family:inherit;';

export function Ads() {
  const { showToast } = useShop();
  const { data: rows, loading, reload } = useAsync(() => fetchAds(), []);
  const ADS = rows ?? [];
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const openNew = () => setEditing({ ...EMPTY });
  const openEdit = (ad: AdRow) =>
    setEditing({ id: ad.id, title: ad.title, placement: ad.placement, status: ad.status });

  const save = async () => {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) {
      showToast('Give the campaign a title');
      return;
    }
    setBusy(true);
    try {
      if (editing.id) {
        await updateAd(editing.id, { title, placement: editing.placement.trim(), status: editing.status });
        showToast('Campaign updated');
      } else {
        await createAd(title, editing.placement.trim() || 'Home · unassigned', editing.status);
        showToast('Campaign created');
      }
      setEditing(null);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save campaign');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (ad: AdRow, status: AdStatus) => {
    try {
      await setAdStatus(ad.id, status);
      showToast(`${ad.title} · ${STATUS_STYLE[status].label}`);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update status');
    }
  };

  const remove = async (ad: AdRow) => {
    if (!window.confirm(`Delete campaign "${ad.title}"?`)) return;
    try {
      await deleteAd(ad.id);
      showToast('Campaign deleted');
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not delete campaign');
    }
  };

  return (
    <div>
      <div style={css('display:flex;justify-content:flex-end;margin-bottom:14px;')}>
        <button onClick={openNew} style={css('background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;border:none;border-radius:12px;padding:11px 18px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>add</span>New campaign
        </button>
      </div>

      {loading && <div style={css('color:#8A7078;font-size:13.5px;')}>Loading campaigns…</div>}
      {!loading && ADS.length === 0 && (
        <div style={css('color:#8A7078;font-size:13.5px;')}>No campaigns yet. Create one to get started.</div>
      )}
      <div className="agx-adm-g2">
        {ADS.map((ad) => {
          const st = STATUS_STYLE[ad.status] ?? STATUS_STYLE.draft;
          return (
            <div key={ad.id} style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);display:flex;')}>
              <div style={css('width:120px;flex:none;background:linear-gradient(150deg,#D6336C,#B02454);position:relative;')}>
                <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.1) 0 2px,transparent 2px 20px);')} />
              </div>
              <div style={css('flex:1;padding:16px;min-width:0;')}>
                <div style={css('display:flex;justify-content:space-between;align-items:center;gap:8px;')}>
                  <span style={css('font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{ad.title}</span>
                  <span style={css(`font-size:11px;font-weight:800;padding:3px 9px;border-radius:8px;flex:none;background:${st.bg};color:${st.fg};`)}>{st.label}</span>
                </div>
                <div style={css('font-size:12.5px;color:#8A7078;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{ad.placement || '—'}</div>
                <div style={css('display:flex;gap:20px;margin-top:12px;')}>
                  <div>
                    <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>{compact(ad.impressions)}</div>
                    <div style={css('font-size:11px;color:#B79AA6;')}>impressions</div>
                  </div>
                  <div>
                    <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>{compact(ad.clicks)}</div>
                    <div style={css('font-size:11px;color:#B79AA6;')}>clicks</div>
                  </div>
                </div>

                <div style={css('display:flex;align-items:center;gap:8px;margin-top:14px;')}>
                  <select
                    value={ad.status}
                    onChange={(e) => changeStatus(ad, e.target.value as AdStatus)}
                    style={css('flex:1;height:36px;border:1.5px solid #F0D8E2;border-radius:10px;background:#FBF6F2;font-size:12.5px;font-weight:700;color:#6B5560;padding:0 8px;cursor:pointer;font-family:inherit;')}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
                    ))}
                  </select>
                  <button onClick={() => openEdit(ad)} title="Edit" style={css('width:36px;height:36px;flex:none;border-radius:10px;border:1.5px solid #F0D8E2;background:#fff;color:#B02454;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                    <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>edit</span>
                  </button>
                  <button onClick={() => remove(ad)} title="Delete" style={css('width:36px;height:36px;flex:none;border-radius:10px;border:1.5px solid #E7A7B4;background:#fff;color:#D6455A;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
                    <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div onClick={() => !busy && setEditing(null)} style={css('position:fixed;inset:0;background:rgba(42,26,32,.45);display:flex;align-items:center;justify-content:center;z-index:40;padding:20px;')}>
          <div onClick={(e) => e.stopPropagation()} style={css('width:420px;max-width:100%;background:#fff;border-radius:20px;padding:24px;box-shadow:0 30px 70px -30px rgba(107,20,54,.7);')}>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;")}>{editing.id ? 'Edit campaign' : 'New campaign'}</div>
            <div style={css('color:#8A7078;font-size:13px;margin-top:3px;margin-bottom:16px;')}>Manage the campaign shown across the marketplace.</div>

            <label style={css('font-size:13px;font-weight:700;color:#7A5C67;display:block;')}>
              Title
              <input autoFocus value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Wedding Season Edit" style={css(field)} />
            </label>
            <label style={css('font-size:13px;font-weight:700;color:#7A5C67;display:block;margin-top:14px;')}>
              Placement
              <input value={editing.placement} onChange={(e) => setEditing({ ...editing, placement: e.target.value })} placeholder="Home hero · carousel slot 1" style={css(field)} />
            </label>
            <label style={css('font-size:13px;font-weight:700;color:#7A5C67;display:block;margin-top:14px;')}>
              Status
              <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as AdStatus })} style={css(field + 'cursor:pointer;')}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
                ))}
              </select>
            </label>

            <div style={css('display:flex;gap:10px;margin-top:22px;')}>
              <button onClick={() => setEditing(null)} disabled={busy} style={css('flex:1;height:48px;border-radius:14px;border:1.5px solid #F0D8E2;background:#fff;color:#6B5560;font-weight:700;font-size:14px;cursor:pointer;')}>Cancel</button>
              <button onClick={save} disabled={busy} style={css('flex:1;height:48px;border-radius:14px;border:none;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:14px;cursor:pointer;')}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
