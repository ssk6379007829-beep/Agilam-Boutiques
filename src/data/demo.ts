/**
 * Demo content ported verbatim from the `Agilam Boutiques v2.dc.html` design.
 * Values must stay in sync with the design file so the screens render the
 * same copy, pricing and imagery tones it was composed against.
 */

export const TONES = ['#F4D6E2', '#F1DCC7', '#E2DAEF', '#D7E7DE', '#F3DFD0', '#E7D9E6', '#DCE4EF', '#F0DAD4'];

export type Product = {
  id: string;
  title: string;
  price: number;
  cat: string;
  boutique: string;
  city: string;
  color: string;
  occasion: string;
  rating: number;
  reviews: number;
  tone: number;
  featured?: boolean;
  stock: number;
  fabric: string;
};

export const PRODUCTS: Product[] = [
  { id: 'p1', title: 'Rose Zari Silk Saree', price: 4899, cat: 'Sarees', boutique: 'Elegance Boutique', city: 'Coimbatore', color: 'Pink', occasion: 'Wedding', rating: 4.7, reviews: 128, tone: 0, featured: true, stock: 12, fabric: 'Kanchipuram Silk' },
  { id: 'p2', title: 'Emerald Bridal Lehenga', price: 12999, cat: 'Lehengas', boutique: 'Pinky’s Boutique', city: 'Madurai', color: 'Green', occasion: 'Bridal', rating: 4.9, reviews: 96, tone: 3, featured: true, stock: 4, fabric: 'Velvet' },
  { id: 'p3', title: 'Blush Georgette Gown', price: 6499, cat: 'Gowns', boutique: 'Trendz Wardrobe', city: 'Chennai', color: 'Pink', occasion: 'Reception', rating: 4.6, reviews: 74, tone: 0, stock: 8, fabric: 'Georgette' },
  { id: 'p4', title: 'Mustard Cotton Kurti', price: 1899, cat: 'Kurtis', boutique: 'Style Studio', city: 'Salem', color: 'Yellow', occasion: 'Casual', rating: 4.5, reviews: 203, tone: 1, stock: 24, fabric: 'Cotton' },
  { id: 'p5', title: 'Lavender Anarkali Gown', price: 5299, cat: 'Gowns', boutique: 'Elegance Boutique', city: 'Coimbatore', color: 'Purple', occasion: 'Party', rating: 4.8, reviews: 61, tone: 2, stock: 6, fabric: 'Net' },
  { id: 'p6', title: 'Maroon Kanjivaram Saree', price: 8999, cat: 'Sarees', boutique: 'Trendz Wardrobe', city: 'Chennai', color: 'Red', occasion: 'Festive', rating: 4.7, reviews: 154, tone: 7, featured: true, stock: 9, fabric: 'Silk' },
  { id: 'p7', title: 'Peach Party Lehenga', price: 7499, cat: 'Lehengas', boutique: 'Style Studio', city: 'Salem', color: 'Peach', occasion: 'Party', rating: 4.4, reviews: 47, tone: 4, stock: 0, fabric: 'Organza' },
  { id: 'p8', title: 'Teal Silk Kurti Set', price: 2499, cat: 'Kurtis', boutique: 'Pinky’s Boutique', city: 'Madurai', color: 'Teal', occasion: 'Festive', rating: 4.6, reviews: 88, tone: 3, stock: 15, fabric: 'Art Silk' },
];

export type Boutique = {
  id: string;
  name: string;
  city: string;
  area: string;
  insta: string;
  rating: number;
  reviews: number;
  tone: number;
  verified: boolean;
  featured?: boolean;
  products: number;
  desc: string;
};

export const BOUTIQUES: Boutique[] = [
  { id: 'b1', name: 'Elegance Boutique', city: 'Coimbatore', area: 'RS Puram, Coimbatore', insta: 'elegance.boutique', rating: 4.7, reviews: 128, tone: 0, verified: true, featured: true, products: 64, desc: 'Handpicked bridal & festive wear crafted by Coimbatore’s finest artisans.' },
  { id: 'b2', name: 'Trendz Wardrobe', city: 'Chennai', area: 'T. Nagar, Chennai', insta: 'trendz.wardrobe', rating: 4.6, reviews: 96, tone: 7, verified: true, products: 120, desc: 'Contemporary ethnic fusion for the modern woman.' },
  { id: 'b3', name: 'Pinky’s Boutique', city: 'Madurai', area: 'KK Nagar, Madurai', insta: 'pinkys.boutique', rating: 4.9, reviews: 212, tone: 2, verified: true, featured: true, products: 88, desc: 'Luxury bridal lehengas and heirloom sarees.' },
  { id: 'b4', name: 'Style Studio', city: 'Salem', area: 'Fairlands, Salem', insta: 'style.studio', rating: 4.4, reviews: 54, tone: 4, verified: false, products: 41, desc: 'Everyday elegance in kurtis, gowns and daily wear.' },
  { id: 'b5', name: 'Silk Symphony', city: 'Coimbatore', area: 'Gandhipuram, Coimbatore', insta: 'silk.symphony', rating: 4.8, reviews: 171, tone: 3, verified: true, products: 97, desc: 'Pure silk sarees, direct from the loom.' },
];

export const CATEGORIES = [
  { name: 'Sarees', icon: 'checkroom', slotId: 'cat-sarees', toneHex: '#F3D3DF' },
  { name: 'Lehengas', icon: 'apparel', slotId: 'cat-lehengas', toneHex: '#EAD6E8' },
  { name: 'Gowns', icon: 'woman', slotId: 'cat-gowns', toneHex: '#E6D8EC' },
  { name: 'Kurtis', icon: 'styler', slotId: 'cat-kurtis', toneHex: '#F1DAD0' },
  { name: 'Bridal', icon: 'diamond', slotId: 'cat-bridal', toneHex: '#F0CBD6' },
  { name: 'More', icon: 'grid_view', slotId: 'cat-more', toneHex: '#E3DCEC' },
];

export const COLORS = [
  { name: 'Pink', hex: '#E7719F' },
  { name: 'Red', hex: '#D6455A' },
  { name: 'Green', hex: '#5FA37E' },
  { name: 'Purple', hex: '#9B7FC7' },
  { name: 'Yellow', hex: '#E0B84B' },
  { name: 'Teal', hex: '#4F9CA3' },
  { name: 'Peach', hex: '#E8A583' },
];

export const OCCASIONS = ['Bridal', 'Wedding', 'Reception', 'Festive', 'Party', 'Casual'];
export const SORTS = ['Latest', 'Price: Low to High', 'Price: High to Low', 'Popularity'];

export type Thread = { id: string; name: string; last: string; time: string; unread: number; online: boolean; tone: number };

export const MESSAGES: Thread[] = [
  { id: 'm1', name: 'Elegance Boutique', last: 'Yes, the Rose Zari saree is available in your size!', time: '2m', unread: 2, online: true, tone: 0 },
  { id: 'm2', name: 'Pinky’s Boutique', last: 'We can customise the blouse. Shall I share options?', time: '1h', unread: 0, online: true, tone: 2 },
  { id: 'm3', name: 'Trendz Wardrobe', last: 'Thank you for shopping with us ❤', time: '3h', unread: 0, online: false, tone: 7 },
  { id: 'm4', name: 'Style Studio', last: 'Your order has been shipped.', time: '1d', unread: 0, online: false, tone: 4 },
];

export const SELLER_MSGS: Thread[] = [
  { id: 'sm1', name: 'Priya Sharma', last: 'Is the emerald lehenga available in M?', time: '5m', unread: 1, online: true, tone: 0 },
  { id: 'sm2', name: 'Anitha R', last: 'Please share the price for the maroon saree.', time: '40m', unread: 0, online: true, tone: 2 },
  { id: 'sm3', name: 'Neha Verma', last: 'Thank you! Order received 😊', time: '2h', unread: 0, online: false, tone: 3 },
];

export const CHAT_THREAD = [
  { me: false, text: 'Hi! Is the Rose Zari Silk Saree still available?', time: '10:02' },
  { me: true, text: 'Hello Priya! Yes it is, in blouse sizes S–XL.', time: '10:04' },
  { me: false, text: 'Lovely. Can you do a custom blouse?', time: '10:05' },
  { me: true, text: 'Absolutely. Custom stitching adds ₹450. Shall I reserve it for you?', time: '10:06' },
];

export type SellerOrder = { id: string; customer: string; item: string; qty: number; amount: number; status: string; date: string; tone: number };

export const ORDERS: SellerOrder[] = [
  { id: '#AGL-2481', customer: 'Priya Sharma', item: 'Rose Zari Silk Saree', qty: 1, amount: 4899, status: 'Pending', date: '15 Jul', tone: 0 },
  { id: '#AGL-2478', customer: 'Anitha R', item: 'Emerald Bridal Lehenga', qty: 1, amount: 12999, status: 'Shipped', date: '14 Jul', tone: 3 },
  { id: '#AGL-2472', customer: 'Neha Verma', item: 'Mustard Cotton Kurti', qty: 2, amount: 3798, status: 'Delivered', date: '12 Jul', tone: 1 },
  { id: '#AGL-2465', customer: 'Divya K', item: 'Lavender Anarkali Gown', qty: 1, amount: 5299, status: 'Pending', date: '11 Jul', tone: 2 },
];

export const CUSTOMERS = [
  { name: 'Priya Sharma', city: 'Coimbatore', orders: 6, spent: 24500, tone: 0 },
  { name: 'Anitha R', city: 'Chennai', orders: 3, spent: 31200, tone: 2 },
  { name: 'Neha Verma', city: 'Madurai', orders: 9, spent: 18900, tone: 3 },
  { name: 'Divya K', city: 'Salem', orders: 2, spent: 9800, tone: 4 },
];

export const NOTIFS = [
  { type: 'Orders', icon: 'shopping_bag', title: 'New order received', body: 'Priya Sharma ordered Rose Zari Silk Saree · ₹4,899', time: '2m', unread: true, tint: '#FCE0EC', ic: '#D6336C' },
  { type: 'Messages', icon: 'chat_bubble', title: 'New message', body: 'Anitha R: Please share the price for the maroon saree.', time: '40m', unread: true, tint: '#E6F0FA', ic: '#3A6EA5' },
  { type: 'Updates', icon: 'local_shipping', title: 'Order shipped', body: 'Order #AGL-2478 marked as shipped.', time: '3h', unread: false, tint: '#E5F3EC', ic: '#2FA36B' },
  { type: 'Updates', icon: 'payments', title: 'Payment received', body: '₹12,999 credited for order #AGL-2478.', time: '5h', unread: false, tint: '#FBF0DA', ic: '#C99A3F' },
  { type: 'Updates', icon: 'star', title: 'New review', body: 'Neha Verma rated Mustard Cotton Kurti 5 ★.', time: '1d', unread: false, tint: '#F3EAF5', ic: '#9B7FC7' },
];

export const APPROVALS = [
  { name: 'Silk Symphony', city: 'Coimbatore', owner: 'Lakshmi N', date: '15 Jul', status: 'Pending', tone: 3 },
  { name: 'Rangoli Threads', city: 'Erode', owner: 'Kavya S', date: '14 Jul', status: 'Pending', tone: 5 },
  { name: 'Trendz Wardrobe', city: 'Chennai', owner: 'Meena R', date: '12 Jul', status: 'Approved', tone: 7 },
  { name: 'Style Studio', city: 'Salem', owner: 'Deepa V', date: '10 Jul', status: 'Approved', tone: 4 },
  { name: 'Quick Fashions', city: 'Tiruppur', owner: 'Ramesh K', date: '09 Jul', status: 'Rejected', tone: 1 },
];

export type BuyerOrder = { id: string; pid: string; title: string; boutique: string; qty: number; size: string; amount: number; placed: string; tone: number; stage: number; eta: string };

export const BUYER_ORDERS: BuyerOrder[] = [
  { id: '#AGL-2481', pid: 'p1', title: 'Rose Zari Silk Saree', boutique: 'Elegance Boutique', qty: 1, size: 'M', amount: 4899, placed: '15 Jul 2026', tone: 0, stage: 2, eta: 'Arrives 19 Jul' },
  { id: '#AGL-2455', pid: 'p6', title: 'Maroon Kanjivaram Saree', boutique: 'Trendz Wardrobe', qty: 1, size: 'Free', amount: 8999, placed: '8 Jul 2026', tone: 7, stage: 4, eta: 'Arriving today' },
  { id: '#AGL-2402', pid: 'p8', title: 'Teal Silk Kurti Set', boutique: 'Pinky’s Boutique', qty: 2, size: 'L', amount: 4998, placed: '27 Jun 2026', tone: 3, stage: 5, eta: 'Delivered 1 Jul' },
];

export const TRACK_STAGES = [
  { label: 'Order Placed', icon: 'receipt_long', sub: 'We’ve received your order' },
  { label: 'Confirmed', icon: 'task_alt', sub: 'Boutique confirmed your order' },
  { label: 'Packed', icon: 'inventory_2', sub: 'Your item is packed & ready' },
  { label: 'Shipped', icon: 'local_shipping', sub: 'Handed to the delivery partner' },
  { label: 'Out for Delivery', icon: 'moped', sub: 'On the way to your address' },
  { label: 'Delivered', icon: 'home', sub: 'Order delivered — enjoy!' },
];

export type Coupon = { code: string; desc: string; off: number; type: 'pct' | 'flat' | 'ship'; min: number; cap?: number; tone: number; expires: string };

export const COUPONS: Coupon[] = [
  { code: 'WELCOME10', desc: '10% off your first order', off: 10, type: 'pct', min: 0, cap: 600, tone: 0, expires: '31 Jul 2026' },
  { code: 'FESTIVE500', desc: '₹500 off on orders above ₹5,000', off: 500, type: 'flat', min: 5000, tone: 3, expires: '20 Aug 2026' },
  { code: 'FREESHIP', desc: 'Free delivery on any order value', off: 0, type: 'ship', min: 0, tone: 5, expires: '30 Sep 2026' },
];

export const PAY_METHODS = [
  { key: 'cod', label: 'Cash on Delivery', sub: 'Pay when your order arrives', icon: 'payments' },
  { key: 'upi', label: 'UPI', sub: 'GPay, PhonePe, Paytm & more', icon: 'qr_code_2' },
  { key: 'card', label: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay', icon: 'credit_card' },
  { key: 'netbanking', label: 'Net Banking', sub: 'All major banks supported', icon: 'account_balance' },
];

export const ANALYTICS = {
  bestSellers: [
    { title: 'Rose Zari Silk Saree', units: 48, revenue: 235152, tone: 0 },
    { title: 'Emerald Bridal Lehenga', units: 31, revenue: 402969, tone: 3 },
    { title: 'Maroon Kanjivaram Saree', units: 27, revenue: 242973, tone: 7 },
    { title: 'Lavender Anarkali Gown', units: 22, revenue: 116578, tone: 2 },
  ],
  topCustomers: [
    { name: 'Anitha R', orders: 3, spent: 31200, tone: 2 },
    { name: 'Priya Sharma', orders: 6, spent: 24500, tone: 0 },
    { name: 'Divya K', orders: 2, spent: 9800, tone: 4 },
  ],
  categories: [
    { name: 'Sarees', pct: 42, color: '#D6336C' },
    { name: 'Lehengas', pct: 28, color: '#B0863B' },
    { name: 'Gowns', pct: 18, color: '#9B7FC7' },
    { name: 'Kurtis', pct: 12, color: '#5FA37E' },
  ],
  revenueBars: [{ m: 'Feb', h: '38%' }, { m: 'Mar', h: '52%' }, { m: 'Apr', h: '46%' }, { m: 'May', h: '68%' }, { m: 'Jun', h: '82%' }, { m: 'Jul', h: '96%' }],
};

export function statusStyle(status: string): { bg: string; fg: string } {
  const map: Record<string, { bg: string; fg: string }> = {
    'Pending': { bg: '#FBF0DA', fg: '#B8860B' },
    'Shipped': { bg: '#E6F0FA', fg: '#3A6EA5' },
    'Delivered': { bg: '#E5F3EC', fg: '#218456' },
    'Approved': { bg: '#E5F3EC', fg: '#218456' },
    'Rejected': { bg: '#FBE3E3', fg: '#C0392B' },
  };
  return map[status] || { bg: '#F1E4EB', fg: '#8A7078' };
}

export const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
