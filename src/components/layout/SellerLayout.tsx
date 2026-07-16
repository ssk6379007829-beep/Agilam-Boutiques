import { Outlet, useLocation } from 'react-router-dom';
import { BottomTabBar, type TabDef } from './BottomTabBar';
import { TopNav } from './TopNav';

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
    <div className="flex min-h-[100dvh] w-full justify-center bg-rose-bg md:items-center md:p-6">
      <div className="flex h-[100dvh] w-full max-w-[520px] flex-col bg-rose-card md:h-[min(920px,calc(100dvh-48px))] md:max-w-3xl md:overflow-hidden md:rounded-[32px] md:shadow-panel lg:max-w-4xl">
        <TopNav tabs={tabs} brand="Agilam Seller" />
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <Outlet />
        </div>
        {showTabBar && (
          <div className="md:hidden">
            <BottomTabBar tabs={tabs} />
          </div>
        )}
      </div>
    </div>
  );
}
