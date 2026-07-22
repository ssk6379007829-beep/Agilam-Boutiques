import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useAuth } from '@/auth/AuthContext';
import { initial } from '@/lib/tokens';

const NAV = [
  { label: 'Overview', icon: 'dashboard', to: '/admin/overview', title: 'Overview', sub: 'Marketplace health at a glance' },
  { label: 'Approvals', icon: 'verified', to: '/admin/approvals', title: 'Boutique Approvals', sub: 'Review and verify new boutiques' },
  { label: 'Catalogue', icon: 'sell', to: '/admin/catalogue', title: 'Catalogue Vocabulary', sub: 'Categories, occasions and fabrics buyers browse by' },
  { label: 'Boutiques', icon: 'storefront', to: '/admin/boutiques', title: 'Boutiques', sub: 'All boutiques on the platform' },
  { label: 'Users', icon: 'group', to: '/admin/users', title: 'Users', sub: 'Buyers and sellers management' },
  { label: 'Products', icon: 'shopping_bag', to: '/admin/products', title: 'Products', sub: 'Moderation and inventory' },
  { label: 'Orders', icon: 'receipt_long', to: '/admin/orders', title: 'Orders', sub: 'Fulfillment and refunds' },
  { label: 'Reports', icon: 'analytics', to: '/admin/reports', title: 'Reports & Analytics', sub: 'Trends and analytics' },
  { label: 'Payments', icon: 'account_balance', to: '/admin/payments', title: 'Payments', sub: 'Transactions and payouts' },
  { label: 'Advertisements', icon: 'campaign', to: '/admin/ads', title: 'Advertisements', sub: 'Campaigns and promotions' },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const active = NAV.find((n) => location.pathname.startsWith(n.to)) ?? NAV[0];

  const logout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div style={css('min-height:100vh;display:flex;background:#FBF6F2;')}>
      <div style={css('min-height:100vh;width:100%;background:#fff;display:flex;')}>
        {/* admin sidebar */}
        <div className="agx-scroll" style={css('width:238px;flex:none;background:#F7EAF0;border-right:1px solid #F0D8E2;padding:20px 14px;height:100vh;position:sticky;top:0;overflow-y:auto;display:flex;flex-direction:column;')}>
          <div style={css('display:flex;align-items:center;gap:10px;padding:0 8px 16px;')}>
            <div style={css("width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#D6336C,#B02454);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>A</div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:19px;")}>Agilam Admin</div>
          </div>

          {NAV.map((a) => {
            const on = location.pathname.startsWith(a.to);
            return (
              <button
                key={a.to}
                onClick={() => navigate(a.to)}
                style={css(`width:100%;display:flex;align-items:center;gap:11px;padding:11px 12px;border:none;border-radius:11px;cursor:pointer;font-size:13.5px;font-weight:${on ? 700 : 600};text-align:left;margin-top:3px;background:${on ? '#fff' : 'transparent'};color:${on ? '#B02454' : '#6B5560'};box-shadow:${on ? '0 6px 16px -10px rgba(107,20,54,.5)' : 'none'};font-family:inherit;`)}
              >
                <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            );
          })}

          <button onClick={logout} style={css('margin-top:auto;width:100%;display:flex;align-items:center;gap:11px;padding:11px 12px;border:none;border-radius:11px;cursor:pointer;font-size:13.5px;font-weight:600;text-align:left;background:transparent;color:#D6455A;font-family:inherit;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>logout</span>
            <span>Log out</span>
          </button>
        </div>

        {/* admin main */}
        <div className="agx-scroll" style={css('flex:1;display:flex;flex-direction:column;min-width:0;')}>
          <div style={css('flex:none;padding:20px 30px;border-bottom:1px solid #F5E4EC;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:6;')}>
            <div>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:28px;line-height:1;")}>{active.title}</div>
              <div style={css('color:#8A7078;font-size:13px;margin-top:3px;')}>{active.sub}</div>
            </div>
            <div style={css('display:flex;align-items:center;gap:14px;')}>
              <div style={css('display:flex;align-items:center;gap:8px;background:#F7EAF0;border-radius:12px;padding:0 12px;height:40px;width:220px;')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#B79AA6;font-size:20px;")}>search</span>
                <input placeholder="Search…" style={css('border:none;background:none;flex:1;font-size:13px;min-width:0;')} />
              </div>
              <div style={css('width:40px;height:40px;border-radius:12px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;position:relative;')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;")}>notifications</span>
                <span style={css('position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:50%;background:#D6455A;')} />
              </div>
              <button onClick={logout} title="Log out" style={css('width:40px;height:40px;border-radius:12px;background:#B02454;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:800;')}>
                {initial(profile?.full_name ?? 'Admin K')}
              </button>
            </div>
          </div>

          {/* `agx-scroll-main` marks this as the page's scroller, so ScrollManager
              resets it on navigation — the window never scrolls in the console. */}
          <div className="agx-scroll agx-scroll-main" style={css('flex:1;overflow-y:auto;padding:26px 30px;background:#FBF6F2;')}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
