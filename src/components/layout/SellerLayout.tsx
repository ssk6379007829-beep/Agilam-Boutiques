import { Outlet, useLocation } from 'react-router-dom';
import { BottomTabBar, type TabDef } from './BottomTabBar';

const tabs: TabDef[] = [
  { label: 'Home', icon: 'home', to: '/seller/dashboard', match: ['/seller/dashboard'] },
  { label: 'Products', icon: 'inventory_2', to: '/seller/products', match: ['/seller/products', '/seller/add-product'] },
  { label: 'Orders', icon: 'receipt_long', to: '/seller/orders', match: ['/seller/orders'] },
  { label: 'Messages', icon: 'chat', to: '/seller/messages', match: ['/seller/messages'] },
  {
    label: 'Profile',
    icon: 'person',
    to: '/seller/profile',
    match: ['/seller/profile', '/seller/earnings', '/seller/subscription', '/seller/boutique', '/seller/settings', '/seller/help', '/seller/customers', '/seller/notifications'],
  },
];

const hideTabBarOn = ['/seller/chat/'];

export function SellerLayout() {
  const location = useLocation();
  const showTabBar = !hideTabBarOn.some((p) => location.pathname.startsWith(p));

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[520px] flex-col bg-rose-card">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <Outlet />
      </div>
      {showTabBar && <BottomTabBar tabs={tabs} />}
    </div>
  );
}
