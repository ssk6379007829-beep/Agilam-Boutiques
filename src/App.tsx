import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { RequireRole, FullscreenLoader } from '@/auth/RequireRole';

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
import { SortSheet } from '@/pages/buyer/SortSheet';
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

/**
 * The seller and admin consoles are only ever reached by signed-in
 * sellers/admins (gated by RequireRole), so their code is split into
 * per-route chunks with React.lazy. A first-time buyer no longer downloads
 * the entire seller + admin bundle just to view a product. The page modules
 * use named exports, so each import is remapped to a default for lazy().
 */
const lazyNamed = <M, K extends keyof M>(loader: () => Promise<M>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));

const SellerLayout = lazyNamed(() => import('@/components/layout/SellerLayout'), 'SellerLayout');
const Dashboard = lazyNamed(() => import('@/pages/seller/Dashboard'), 'Dashboard');
const AddProduct = lazyNamed(() => import('@/pages/seller/AddProduct'), 'AddProduct');
const MyProducts = lazyNamed(() => import('@/pages/seller/MyProducts'), 'MyProducts');
const Orders = lazyNamed(() => import('@/pages/seller/Orders'), 'Orders');
const OrderDetail = lazyNamed(() => import('@/pages/seller/OrderDetail'), 'OrderDetail');
const Customers = lazyNamed(() => import('@/pages/seller/Customers'), 'Customers');
const Notifications = lazyNamed(() => import('@/pages/seller/Notifications'), 'Notifications');
const SellerMessages = lazyNamed(() => import('@/pages/seller/Messages'), 'Messages');
const SellerChat = lazyNamed(() => import('@/pages/seller/Chat'), 'Chat');
const Billing = lazyNamed(() => import('@/pages/seller/Billing'), 'Billing');
const Earnings = lazyNamed(() => import('@/pages/seller/Earnings'), 'Earnings');
const Analytics = lazyNamed(() => import('@/pages/seller/Analytics'), 'Analytics');
const BoutiqueProfileEdit = lazyNamed(() => import('@/pages/seller/BoutiqueProfileEdit'), 'BoutiqueProfileEdit');
const ProfileHub = lazyNamed(() => import('@/pages/seller/ProfileHub'), 'ProfileHub');
const Settings = lazyNamed(() => import('@/pages/seller/Settings'), 'Settings');
const Help = lazyNamed(() => import('@/pages/seller/Help'), 'Help');

const AdminLayout = lazyNamed(() => import('@/components/layout/AdminLayout'), 'AdminLayout');
const Overview = lazyNamed(() => import('@/pages/admin/Overview'), 'Overview');
const Approvals = lazyNamed(() => import('@/pages/admin/Approvals'), 'Approvals');
const BoutiquesTable = lazyNamed(() => import('@/pages/admin/BoutiquesTable'), 'BoutiquesTable');
const Users = lazyNamed(() => import('@/pages/admin/Users'), 'Users');
const ProductsAdmin = lazyNamed(() => import('@/pages/admin/ProductsAdmin'), 'ProductsAdmin');
const OrdersAdmin = lazyNamed(() => import('@/pages/admin/OrdersAdmin'), 'OrdersAdmin');
const Reports = lazyNamed(() => import('@/pages/admin/Reports'), 'Reports');
const Payments = lazyNamed(() => import('@/pages/admin/Payments'), 'Payments');
const Ads = lazyNamed(() => import('@/pages/admin/Ads'), 'Ads');

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
        {/* Sort shares the results grid behind a lighter sort-only sheet. */}
        <Route path="sort" element={<><Results /><SortSheet /></>} />
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
            <Suspense fallback={<FullscreenLoader />}>
              <SellerLayout />
            </Suspense>
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
        <Route path="billing" element={<Billing />} />
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
            <Suspense fallback={<FullscreenLoader />}>
              <AdminLayout />
            </Suspense>
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="boutiques" element={<BoutiquesTable />} />
        <Route path="users" element={<Users />} />
        <Route path="products" element={<ProductsAdmin />} />
        <Route path="orders" element={<OrdersAdmin />} />
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
