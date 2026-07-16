import { Outlet, useLocation } from 'react-router-dom';
import { BottomTabBar, type TabDef } from './BottomTabBar';
import { TopNav } from './TopNav';

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
    <div className="flex min-h-[100dvh] w-full justify-center bg-rose-bg md:items-center md:p-6">
      <div className="flex h-[100dvh] w-full max-w-[520px] flex-col bg-rose-card md:h-[min(920px,calc(100dvh-48px))] md:max-w-3xl md:overflow-hidden md:rounded-[32px] md:shadow-panel lg:max-w-4xl">
        <TopNav tabs={tabs} brand="Agilam" />
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
