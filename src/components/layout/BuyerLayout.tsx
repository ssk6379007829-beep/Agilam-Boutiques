import { Outlet, useLocation } from 'react-router-dom';
import { BottomTabBar, type TabDef } from './BottomTabBar';

const tabs: TabDef[] = [
  { label: 'Home', icon: 'home', to: '/buyer/home', match: ['/buyer/home', '/buyer/results', '/buyer/filter'] },
  { label: 'Boutiques', icon: 'storefront', to: '/buyer/boutiques', match: ['/buyer/boutiques', '/buyer/boutique/'] },
  { label: 'Messages', icon: 'chat', to: '/buyer/messages', match: ['/buyer/messages', '/buyer/chat'] },
  { label: 'Profile', icon: 'person', to: '/buyer/profile', match: ['/buyer/profile', '/buyer/wishlist'] },
];

const hideTabBarOn = ['/buyer/product/', '/buyer/chat/'];

export function BuyerLayout() {
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
