import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useAuth } from '@/auth/AuthContext';

export function Profile() {
  const navigate = useNavigate();
  const { openSellModal, showToast } = useShop();
  const { session, signOut } = useAuth();

  const rows = [
    { label: 'My Orders', icon: 'receipt_long', border: '1px solid #F5E4EC', go: () => navigate('/buyer/orders') },
    { label: 'Wishlist', icon: 'favorite', border: '1px solid #F5E4EC', go: () => navigate('/buyer/wishlist') },
    { label: 'My Coupons', icon: 'confirmation_number', border: '1px solid #F5E4EC', go: () => navigate('/buyer/coupons') },
    { label: 'Addresses', icon: 'location_on', border: '1px solid #F5E4EC', go: () => showToast('Addresses') },
    { label: 'Payment Methods', icon: 'credit_card', border: '1px solid #F5E4EC', go: () => showToast('Payment Methods') },
    { label: 'Settings', icon: 'settings', border: '1px solid #F5E4EC', go: () => showToast('Settings') },
    { label: 'Help & Support', icon: 'help', border: 'none', go: () => showToast('Help & Support') },
  ];

  // Log out lands on the role picker rather than the loading screen, which
  // would just drop straight back into the buyer app.
  const logout = async () => {
    if (session) await signOut();
    navigate('/splash', { replace: true });
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('background:linear-gradient(150deg,#D6336C,#B02454);padding:24px 20px 30px;color:#fff;')}>
        <div style={css('display:flex;align-items:center;gap:14px;')}>
          <div style={css("width:64px;height:64px;border-radius:20px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:28px;")}>P</div>
          <div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>Priya Sharma</div>
            <div style={css('opacity:.85;font-size:13px;')}>+91 98765 43210 · Coimbatore</div>
          </div>
        </div>
      </div>

      <div style={css('margin:-16px 20px 0;background:#fff;border-radius:18px;padding:6px;box-shadow:0 12px 30px -20px rgba(107,20,54,.6);')}>
        {rows.map((r) => (
          <button key={r.label} onClick={r.go} style={css(`width:100%;display:flex;align-items:center;gap:13px;padding:14px 12px;border:none;background:none;cursor:pointer;border-bottom:${r.border};text-align:left;`)}>
            <span style={css('width:38px;height:38px;border-radius:11px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:20px;")}>{r.icon}</span>
            </span>
            <span style={css('flex:1;font-weight:700;font-size:14.5px;')}>{r.label}</span>
            <span style={css("font-family:'Material Symbols Outlined';color:#CBB0BC;")}>chevron_right</span>
          </button>
        ))}
      </div>

      <button onClick={openSellModal} style={css('margin:14px 20px 0;width:calc(100% - 40px);display:flex;align-items:center;gap:13px;padding:14px 15px;border:none;border-radius:16px;background:linear-gradient(135deg,#8E1C44,#B02454);color:#fff;cursor:pointer;box-shadow:0 16px 34px -18px rgba(142,28,68,.9);text-align:left;')}>
        <span style={css('width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex:none;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:22px;")}>storefront</span>
        </span>
        <span style={css('flex:1;')}>
          <span style={css('display:block;font-weight:800;font-size:15px;')}>Sell on Agilam</span>
          <span style={css('display:block;font-size:12.5px;opacity:.85;margin-top:2px;')}>Open your boutique &amp; start selling</span>
        </span>
        <span style={css("font-family:'Material Symbols Outlined';opacity:.8;")}>chevron_right</span>
      </button>

      <button onClick={logout} style={css('margin:16px 20px 0;width:calc(100% - 40px);height:50px;border:1.5px solid #F0D8E2;background:#fff;color:#D6455A;border-radius:14px;font-weight:800;cursor:pointer;')}>
        Log out
      </button>

      <button onClick={() => navigate('/admin/login')} style={css('margin:14px 20px 0;width:calc(100% - 40px);height:42px;border:none;background:none;color:#B79AA6;font-size:12.5px;font-weight:700;letter-spacing:.04em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;')}>
        <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>shield_person</span>Admin login · internal use
      </button>
    </div>
  );
}
