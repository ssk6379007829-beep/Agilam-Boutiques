import { AppShell, type TabDef } from './AppShell';
import { useShop } from '@/state/ShopContext';
import { LoginPrompt } from '@/components/buyer/LoginPrompt';

export function BuyerLayout() {
  const { cartCount } = useShop();

  const tabs: TabDef[] = [
    { label: 'Home', icon: 'home', to: '/buyer/home', match: ['/buyer/home', '/buyer/results', '/buyer/filter', '/buyer/sort'] },
    { label: 'Boutiques', icon: 'storefront', to: '/buyer/boutiques', match: ['/buyer/boutiques', '/buyer/boutique'] },
    { label: 'Cart', icon: 'shopping_bag', to: '/buyer/cart', match: ['/buyer/cart', '/buyer/checkout', '/buyer/payment', '/buyer/order-confirmation'], badge: cartCount },
    { label: 'Orders', icon: 'receipt_long', to: '/buyer/orders', match: ['/buyer/orders'] },
    { label: 'Messages', icon: 'chat', to: '/buyer/messages', match: ['/buyer/messages', '/buyer/chat'] },
  ];

  return (
    <>
      <AppShell tabs={tabs} profileTo="/buyer/profile" />
      <LoginPrompt />
    </>
  );
}
