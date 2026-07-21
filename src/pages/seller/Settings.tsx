import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { updateBoutique } from '@/data/boutiques';

const INITIAL_ROWS = [
  { label: 'Push notifications', icon: 'notifications', on: true },
  { label: 'Order alerts', icon: 'shopping_bag', on: true },
  { label: 'WhatsApp sync', icon: 'chat_bubble', on: true },
  { label: 'Show boutique publicly', icon: 'visibility', on: true },
  { label: 'Dark mode', icon: 'dark_mode', on: false },
];

export function Settings() {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const { boutique, reload } = useMyBoutique();
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [insta, setInsta] = useState('');
  const [addr, setAddr] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed from the signed-in seller's own boutique row rather than sample copy.
  useEffect(() => {
    if (!boutique) return;
    setInsta(boutique.instagram ?? '');
    setAddr([boutique.area, boutique.city].filter(Boolean).join(', '));
  }, [boutique]);

  const toggle = (label: string) =>
    setRows((rs) => rs.map((r) => (r.label === label ? { ...r, on: !r.on } : r)));

  // "RS Puram, Coimbatore" -> area + city; a single value is treated as the city.
  const save = async () => {
    if (!boutique) return showToast('No boutique linked to this account yet');
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    const city = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '';
    const area = parts.length > 1 ? parts.slice(0, -1).join(', ') : '';
    setSaving(true);
    try {
      await updateBoutique(boutique.id, { instagram: insta.trim().replace(/^@/, '') || null, area, city });
      reload();
      showToast('Profile saved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/profile')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>Settings</div>
      </div>

      <div style={css('margin:4px 20px 0;background:#fff;border-radius:18px;padding:18px 16px 20px;box-shadow:0 12px 30px -20px rgba(107,20,54,.6);')}>
        <div style={css('display:flex;align-items:center;gap:9px;margin-bottom:4px;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:20px;")}>storefront</span>
          <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:18px;")}>Boutique Profile</span>
        </div>
        <div style={css('font-size:12.5px;color:#8A7078;margin-bottom:14px;')}>Shown to buyers on your boutique page.</div>

        <label style={css('display:block;font-size:12px;font-weight:800;color:#6B5560;letter-spacing:.02em;margin-bottom:6px;')}>INSTAGRAM HANDLE</label>
        <div style={css('display:flex;align-items:center;gap:8px;border:1.5px solid #F0D8E2;border-radius:13px;padding:0 12px;background:#FDFAFB;margin-bottom:15px;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#DD2A7B;font-size:20px;")}>photo_camera</span>
          <span style={css('color:#B79AA6;font-weight:700;')}>@</span>
          <input value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="yourboutique" style={css('flex:1;border:none;outline:none;background:none;padding:13px 0;font-size:14px;font-weight:600;color:#241019;min-width:0;')} />
        </div>

        <label style={css('display:block;font-size:12px;font-weight:800;color:#6B5560;letter-spacing:.02em;margin-bottom:6px;')}>SHOP ADDRESS</label>
        <div style={css('display:flex;align-items:center;gap:8px;border:1.5px solid #F0D8E2;border-radius:13px;padding:0 12px;background:#FDFAFB;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:20px;")}>location_on</span>
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Area, City" style={css('flex:1;border:none;outline:none;background:none;padding:13px 0;font-size:14px;font-weight:600;color:#241019;min-width:0;')} />
        </div>

        <button onClick={save} disabled={saving || !boutique} style={css(`margin-top:16px;width:100%;height:48px;border:none;border-radius:13px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 12px 26px -14px rgba(214,51,108,.8);opacity:${saving || !boutique ? 0.6 : 1};`)}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>

      <div style={css('margin:16px 20px 0;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -20px rgba(107,20,54,.6);')}>
        {rows.map((r, i) => (
          <div key={r.label} onClick={() => toggle(r.label)} style={css(`display:flex;align-items:center;gap:13px;padding:15px 14px;border-bottom:${i === rows.length - 1 ? 'none' : '1px solid #F5E4EC'};cursor:pointer;`)}>
            <span style={css('width:36px;height:36px;border-radius:11px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:19px;")}>{r.icon}</span>
            </span>
            <span style={css('flex:1;font-weight:700;font-size:14px;')}>{r.label}</span>
            <div style={css(`width:44px;height:26px;border-radius:14px;background:${r.on ? '#2FA36B' : '#E0CDD6'};position:relative;transition:background .2s ease;`)}>
              <span style={css(`position:absolute;top:3px;${r.on ? 'right' : 'left'}:3px;width:20px;height:20px;border-radius:50%;background:#fff;`)} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/buyer/home')} style={css('margin:16px 20px 0;width:calc(100% - 40px);display:flex;align-items:center;gap:13px;padding:14px 15px;border:none;border-radius:16px;background:#fff;color:#B02454;cursor:pointer;box-shadow:0 12px 30px -20px rgba(107,20,54,.6);text-align:left;')}>
        <span style={css('width:40px;height:40px;border-radius:12px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;flex:none;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:22px;")}>swap_horiz</span>
        </span>
        <span style={css('flex:1;')}>
          <span style={css('display:block;font-weight:800;font-size:15px;')}>Switch to Buyer</span>
          <span style={css('display:block;font-size:12.5px;color:#8A7078;margin-top:2px;')}>Shop on Agilam as a customer</span>
        </span>
        <span style={css("font-family:'Material Symbols Outlined';color:#CBB0BC;")}>chevron_right</span>
      </button>
    </div>
  );
}
