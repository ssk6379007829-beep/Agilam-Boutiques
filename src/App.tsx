import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from '@/auth/RequireRole';

import { Splash } from '@/pages/auth/Splash';
import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';
import { AdminLogin } from '@/pages/admin/AdminLogin';

import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Home } from '@/pages/buyer/Home';
import { Results } from '@/pages/buyer/Results';
import { Boutiques } from '@/pages/buyer/Boutiques';
import { BoutiqueProfile } from '@/pages/buyer/BoutiqueProfile';
import { ProductDetail } from '@/pages/buyer/ProductDetail';
import { Wishlist } from '@/pages/buyer/Wishlist';
import { Messages as BuyerMessages } from '@/pages/buyer/Messages';
import { Chat as BuyerChat } from '@/pages/buyer/Chat';
import { Profile as BuyerProfile } from '@/pages/buyer/Profile';

import { SellerLayout } from '@/components/layout/SellerLayout';
import { Dashboard } from '@/pages/seller/Dashboard';
import { AddProduct } from '@/pages/seller/AddProduct';
import { MyProducts } from '@/pages/seller/MyProducts';
import { Orders } from '@/pages/seller/Orders';
import { OrderDetail } from '@/pages/seller/OrderDetail';
import { Customers } from '@/pages/seller/Customers';
import { Notifications } from '@/pages/seller/Notifications';
import { Messages as SellerMessages } from '@/pages/seller/Messages';
import { Chat as SellerChat } from '@/pages/seller/Chat';
import { Earnings } from '@/pages/seller/Earnings';
import { BoutiqueProfileEdit } from '@/pages/seller/BoutiqueProfileEdit';
import { Subscription } from '@/pages/seller/Subscription';
import { ProfileHub } from '@/pages/seller/ProfileHub';
import { Settings } from '@/pages/seller/Settings';
import { Help } from '@/pages/seller/Help';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { Overview } from '@/pages/admin/Overview';
import { Approvals } from '@/pages/admin/Approvals';
import { BoutiquesTable } from '@/pages/admin/BoutiquesTable';
import { Subscriptions } from '@/pages/admin/Subscriptions';
import { Featured } from '@/pages/admin/Featured';
import { CustomersAdmin } from '@/pages/admin/CustomersAdmin';
import { Reports } from '@/pages/admin/Reports';
import { Payments } from '@/pages/admin/Payments';
import { Ads } from '@/pages/admin/Ads';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/auth/signin/:role" element={<SignIn />} />
      <Route path="/auth/signup/:role" element={<SignUp />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route
        path="/buyer"
        element={
          <RequireRole role="buyer">
            <BuyerLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="results" element={<Results />} />
        <Route path="boutiques" element={<Boutiques />} />
        <Route path="boutique/:id" element={<BoutiqueProfile />} />
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="messages" element={<BuyerMessages />} />
        <Route path="chat/:id" element={<BuyerChat />} />
        <Route path="profile" element={<BuyerProfile />} />
      </Route>

      <Route
        path="/seller"
        element={
          <RequireRole role="seller">
            <SellerLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="add-product" element={<AddProduct />} />
        <Route path="products" element={<MyProducts />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="messages" element={<SellerMessages />} />
        <Route path="chat/:id" element={<SellerChat />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="boutique" element={<BoutiqueProfileEdit />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="profile" element={<ProfileHub />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<Help />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="boutiques" element={<BoutiquesTable />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="featured" element={<Featured />} />
        <Route path="customers" element={<CustomersAdmin />} />
        <Route path="reports" element={<Reports />} />
        <Route path="payments" element={<Payments />} />
        <Route path="ads" element={<Ads />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
