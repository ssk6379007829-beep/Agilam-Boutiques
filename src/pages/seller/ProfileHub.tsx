import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useAuth } from '@/auth/AuthContext';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { resolveDisplayName } from '@/lib/displayName';

export function ProfileHub() {
  const navigate = useNavigate();
  const { signOut, profile, session } = useAuth();
  const { boutique, loading } = useMyBoutique();

  // Header identity comes from the signed-in account: the seller's own boutique
  // row plus their profile/OAuth name — never a hardcoded sample boutique.
  const ownerName = resolveDisplayName(profile, session);
  const boutiqueName = boutique?.name || (loading ? '' : ownerName ? `${ownerName}'s Boutique` : 'Your Boutique');
  const initial = (boutiqueName || ownerName || 'B').trim().charAt(0).toUpperCase();
  const subline = [boutique?.city, ownerName && `Owner: ${ownerName}`].filter(Boolean).join(' · ');

  const rows = [
    { label: 'Inspire Posts', icon: 'auto_awesome', border: '1px solid #F5E4EC', to: '/seller/posts' },
    { label: 'Billing (Offline Sales)', icon: 'receipt_long', border: '1px solid #F5E4EC', to: '/seller/billing' },
    { label: 'Earnings', icon: 'payments', border: '1px solid #F5E4EC', to: '/seller/earnings' },
    { label: 'Analytics', icon: 'insights', border: '1px solid #F5E4EC', to: '/seller/analytics' },
    { label: 'Boutique Profile', icon: 'store', border: '1px solid #F5E4EC', to: '/seller/boutique' },
    { label: 'Customers', icon: 'group', border: '1px solid #F5E4EC', to: '/seller/customers' },
    { label: 'Notifications', icon: 'notifications', border: '1px solid #F5E4EC', to: '/seller/notifications' },
    { label: 'Settings', icon: 'settings', border: '1px solid #F5E4EC', to: '/seller/settings' },
    { label: 'Help & Support', icon: 'help', border: 'none', to: '/seller/help' },
  ];

  const logout = async () => {
    await signOut();
    navigate('/buyer/home', { replace: true });
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('background:linear-gradient(150deg,#D6336C,#B02454);padding:24px 20px 30px;color:#fff;')}>
        <div style={css('display:flex;align-items:center;gap:14px;')}>
          <div style={css("width:64px;height:64px;flex:none;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:28px;")}>
            {boutique?.logo_url ? <img src={boutique.logo_url} alt="" style={css('width:100%;height:100%;object-fit:cover;')} /> : initial}
          </div>
          <div>
            <div style={css('display:flex;align-items:center;gap:5px;')}>
              <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:23px;")}>{boutiqueName || '…'}</span>
              {boutique?.verified && <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>verified</span>}
            </div>
            {subline && <div style={css('opacity:.85;font-size:13px;')}>{subline}</div>}
            {session?.user?.email && <div style={css('opacity:.7;font-size:12px;margin-top:2px;')}>{session.user.email}</div>}
          </div>
        </div>
      </div>

      <div style={css('margin:-16px 20px 0;background:#fff;border-radius:18px;padding:6px;box-shadow:0 12px 30px -20px rgba(107,20,54,.6);')}>
        {rows.map((r) => (
          <button key={r.label} onClick={() => navigate(r.to)} style={css(`width:100%;display:flex;align-items:center;gap:13px;padding:14px 12px;border:none;background:none;cursor:pointer;border-bottom:${r.border};text-align:left;`)}>
            <span style={css('width:38px;height:38px;border-radius:11px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:20px;")}>{r.icon}</span>
            </span>
            <span style={css('flex:1;font-weight:700;font-size:14.5px;')}>{r.label}</span>
            <span style={css("font-family:'Material Symbols Outlined';color:#CBB0BC;")}>chevron_right</span>
          </button>
        ))}
      </div>

      <button onClick={logout} style={css('margin:16px 20px 0;width:calc(100% - 40px);height:50px;border:1.5px solid #F0D8E2;background:#fff;color:#D6455A;border-radius:14px;font-weight:800;cursor:pointer;')}>
        Log out
      </button>
    </div>
  );
}
