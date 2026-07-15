import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/auth/AuthContext';
import { initial } from '@/lib/tokens';

const NAV = [
  { label: 'Overview', icon: 'dashboard', to: '/admin/overview', sub: 'Marketplace health at a glance' },
  { label: 'Approvals', icon: 'verified', to: '/admin/approvals', sub: 'Review and verify new boutiques' },
  { label: 'Boutiques', icon: 'storefront', to: '/admin/boutiques', sub: 'All boutiques on the platform' },
  { label: 'Subscriptions', icon: 'workspace_premium', to: '/admin/subscriptions', sub: 'Plans, renewals and commission' },
  { label: 'Featured', icon: 'star', to: '/admin/featured', sub: 'Manage premium placements' },
  { label: 'Customers', icon: 'group', to: '/admin/customers', sub: 'All shoppers across Tamil Nadu' },
  { label: 'Reports', icon: 'analytics', to: '/admin/reports', sub: 'Trends and analytics' },
  { label: 'Payments', icon: 'account_balance', to: '/admin/payments', sub: 'Transactions and payouts' },
  { label: 'Advertisements', icon: 'campaign', to: '/admin/ads', sub: 'Campaigns and promotions' },
];

export function AdminLayout() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const active = NAV.find((n) => location.pathname.startsWith(n.to)) ?? NAV[0];

  return (
    <div className="flex h-screen bg-[#FDF6F9]">
      <aside className="no-scrollbar flex w-[238px] flex-none flex-col overflow-y-auto border-r border-rose-border bg-rose-chipAlt p-3.5">
        <div className="flex items-center gap-2.5 px-2 pb-4">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[11px] font-serif text-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
          >
            A
          </div>
          <div className="font-serif text-[19px] font-bold">Agilam Admin</div>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `mt-0.5 flex w-full items-center gap-2.5 rounded-[11px] border-none px-3 py-2.5 text-left text-[13.5px] font-semibold no-underline ${
                isActive ? 'bg-white font-bold text-rose-primaryDark shadow-raised' : 'bg-transparent text-rose-label'
              }`
            }
          >
            <Icon name={n.icon} className="text-xl" />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => signOut()}
          className="mt-auto flex w-full items-center gap-2.5 rounded-[11px] border-none bg-transparent px-3 py-2.5 text-left text-[13.5px] font-semibold text-rose-danger"
        >
          <Icon name="logout" className="text-xl" />
          <span>Log out</span>
        </button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-none items-center justify-between border-b border-rose-borderSoft px-8 py-5">
          <div>
            <div className="font-serif text-[28px] font-bold leading-none">{active.label}</div>
            <div className="mt-1 text-[13px] text-rose-muted">{active.sub}</div>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-[220px] items-center gap-2 rounded-xl bg-rose-chipAlt px-3">
              <Icon name="search" className="text-xl text-rose-mutedSoft" />
              <input placeholder="Search…" className="flex-1 border-none bg-transparent text-[13px] outline-none" />
            </div>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-rose-chip">
              <Icon name="notifications" style={{ color: '#D6336C' }} />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-primaryDark font-extrabold text-white">
              {initial(profile?.full_name ?? 'Admin')}
            </div>
          </div>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-8 py-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
