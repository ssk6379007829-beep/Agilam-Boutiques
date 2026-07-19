import { Navigate, Route, Routes } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { RequireRole } from '@/auth/RequireRole';

import { Loading } from '@/pages/Loading';
import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';
import { Otp } from '@/pages/auth/Otp';
import { AuthCallback } from '@/pages/auth/AuthCallback';
import { SellerOnboarding } from '@/pages/seller/SellerOnboarding';
import { AdminLogin } from '@/pages/admin/AdminLogin';

import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Home } from '@/pages/buyer/Home';
import { Results } from '@/pages/buyer/Results';
import { Boutiques } from '@/pages/buyer/Boutiques';
import { BoutiqueProfile } from '@/pages/buyer/BoutiqueProfile';
import { ProductDetail } from '@/pages/buyer/ProductDetail';
import { Wishlist } from '@/pages/buyer/Wishlist';
import { FilterSheet } from '@/pages/buyer/FilterSheet';
import { Cart } from '@/pages/buyer/Cart';
import { Checkout } from '@/pages/buyer/Checkout';
import { Payment } from '@/pages/buyer/Payment';
import { OrderConfirmation } from '@/pages/buyer/OrderConfirmation';
import { MyOrders } from '@/pages/buyer/MyOrders';
import { TrackOrder } from '@/pages/buyer/TrackOrder';
import { Coupons } from '@/pages/buyer/Coupons';
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
import { Analytics } from '@/pages/seller/Analytics';
import { BoutiqueProfileEdit } from '@/pages/seller/BoutiqueProfileEdit';
import { ProfileHub } from '@/pages/seller/ProfileHub';
import { Settings } from '@/pages/seller/Settings';
import { Help } from '@/pages/seller/Help';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { Overview } from '@/pages/admin/Overview';
import { Approvals } from '@/pages/admin/Approvals';
import { BoutiquesTable } from '@/pages/admin/BoutiquesTable';
import { CustomersAdmin } from '@/pages/admin/CustomersAdmin';
import { Reports } from '@/pages/admin/Reports';
import { Payments } from '@/pages/admin/Payments';
import { Ads } from '@/pages/admin/Ads';

export default function App() {
  return (
    <>
      <Routes>
      <Route path="/" element={<Loading />} />
      <Route path="/auth/signin/:role" element={<SignIn />} />
      <Route path="/auth/signup/:role" element={<SignUp />} />
      <Route path="/auth/otp/:role" element={<Otp />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/seller/onboarding" element={<SellerOnboarding />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Clean, shareable public boutique link — e.g. /b/elegance-boutique.
          Renders the same profile the buyer app uses, so a link dropped in an
          Instagram bio or WhatsApp status deep-links straight to the boutique. */}
      <Route path="/b/:slug" element={<BoutiqueProfile />} />

      {/* Buyers browse without signing in — the design treats the buyer app as
          the public surface and only gates the seller/admin consoles. */}
      <Route path="/buyer" element={<BuyerLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="results" element={<Results />} />
        {/* The sheet is a fixed overlay, so keep the results grid behind it. */}
        <Route path="filter" element={<><Results /><FilterSheet /></>} />
        <Route path="boutiques" element={<Boutiques />} />
        <Route path="boutique/:id" element={<BoutiqueProfile />} />
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="payment" element={<Payment />} />
        <Route path="order-confirmation" element={<OrderConfirmation />} />
        <Route path="orders" element={<MyOrders />} />
        <Route path="orders/:id/track" element={<TrackOrder />} />
        <Route path="coupons" element={<Coupons />} />
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
        <Route path="analytics" element={<Analytics />} />
        <Route path="boutique" element={<BoutiqueProfileEdit />} />
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
        <Route path="customers" element={<CustomersAdmin />} />
        <Route path="reports" element={<Reports />} />
        <Route path="payments" element={<Payments />} />
        <Route path="ads" element={<Ads />} />
      </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SpeedInsights />
    </>
  );
}
