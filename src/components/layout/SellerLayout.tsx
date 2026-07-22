import { AppShell, type TabDef } from './AppShell';

const tabs: TabDef[] = [
  { label: 'Home', icon: 'home', to: '/seller/dashboard', match: ['/seller/dashboard'] },
  { label: 'Products', icon: 'inventory_2', to: '/seller/products', match: ['/seller/products', '/seller/add-product'] },
  { label: 'Orders', icon: 'receipt_long', to: '/seller/orders', match: ['/seller/orders'] },
  { label: 'Messages', icon: 'chat', to: '/seller/messages', match: ['/seller/messages', '/seller/chat'] },
  {
    label: 'Profile',
    icon: 'person',
    to: '/seller/profile',
    match: ['/seller/profile', '/seller/earnings', '/seller/analytics', '/seller/boutique', '/seller/settings', '/seller/help', '/seller/customers', '/seller/notifications', '/seller/posts'],
  },
];

export function SellerLayout() {
  return <AppShell tabs={tabs} profileTo="/seller/profile" homeTo="/seller/dashboard" />;
}
