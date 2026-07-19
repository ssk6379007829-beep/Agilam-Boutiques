import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useAuth } from '@/auth/AuthContext';
import { ProfileEditSheet } from '@/components/buyer/ProfileEditSheet';
import { AccountSheet } from '@/components/buyer/AccountSheet';
import { readOrders } from '@/lib/orderHistory';
import { syncAccount } from '@/lib/accountSync';

/** "selva.kumar" / "selva_kumar" -> "Selva Kumar" for an email-derived name. */
function prettifyName(local: string): string {
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export function Profile() {
  const navigate = useNavigate();
  const { openSellModal, showToast, guest, setGuest, clearGuest, hasBuyerDetails, wishlist, cartCount } = useShop();
  const { session, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Real-time figures: the buyer's own placed orders (localStorage, merged with
  // any read from their account), saved wishlist and current bag.
  const [orderCount, setOrderCount] = useState(() => readOrders().length);
  const wishCount = Object.keys(wishlist).length;

  // Signed in (Google / email code / password) means profile & orders sync
  // across devices via the account.
  const signedIn = !!session;
  const accountEmail = session?.user?.email ?? '';

  // Push edits to the account, pull the saved profile + orders back, merge
  // locally. An empty `msg` runs it silently (used for the on-return refresh).
  const doSync = async (patch?: { name: string; phone: string; city: string; address: string }, msg = 'Synced across devices') => {
    setSyncing(true);
    try {
      // Pass the current local details so anything entered as a guest migrates
      // up to the account rather than being lost on logout.
      const prof = await syncAccount(guest, patch);
      if (prof) setGuest({ name: prof.name, phone: prof.phone, city: prof.city, address: prof.address });
      setOrderCount(readOrders().length);
      if (msg) showToast(msg);
    } catch (e) {
      if (msg) showToast(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const onSignedIn = () => {
    setAccountOpen(false);
    showToast('Signed in');
  };

  // Whenever we land on the profile already signed in — a fresh login, a Google
  // redirect, a page reload, or after logout cleared local data — pull the saved
  // profile + orders back so previously-added data always shows. Runs once.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (signedIn && !syncedRef.current) {
      syncedRef.current = true;
      void doSync(undefined, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Once signed in, name the account after the Google/email identity.
  const meta = session?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const emailName = accountEmail ? prettifyName(accountEmail.split('@')[0]) : '';
  const accountName = guest.name || meta?.full_name || meta?.name || emailName || 'Shopper';

  // A guest with no saved details and no account has nothing to show or edit yet.
  const guestNoAccount = !signedIn && !hasBuyerDetails;
  const name = signedIn ? accountName : hasBuyerDetails ? guest.name : 'Guest shopper';
  const initial = guestNoAccount ? '' : name.trim().charAt(0).toUpperCase();
  const contactLine = [guest.phone && `+91 ${guest.phone}`, guest.city].filter(Boolean).join(' · ');
  const subline = signedIn
    ? contactLine || accountEmail
    : hasBuyerDetails
      ? contactLine
      : 'Add your details for a smoother checkout';

  const stats = [
    { label: 'Orders', value: orderCount, icon: 'receipt_long', go: () => navigate('/buyer/orders') },
    { label: 'Wishlist', value: wishCount, icon: 'favorite', go: () => navigate('/buyer/wishlist') },
    { label: 'Bag', value: cartCount, icon: 'shopping_bag', go: () => navigate('/buyer/cart') },
  ];

  const rows = [
    { label: 'My Orders', sub: 'Track & manage purchases', icon: 'receipt_long', go: () => navigate('/buyer/orders') },
    { label: 'Wishlist', sub: 'Pieces you saved', icon: 'favorite', go: () => navigate('/buyer/wishlist') },
    { label: 'Messages', sub: 'Chats with boutiques', icon: 'chat', go: () => navigate('/buyer/messages') },
    { label: 'Coupons & Offers', sub: 'Deals ready to use', icon: 'confirmation_number', go: () => navigate('/buyer/coupons') },
    { label: 'Delivery Address', sub: guest.address ? guest.address : 'Add where we ship', icon: 'location_on', go: () => setEditing(true) },
    { label: 'Help & Support', sub: 'We’re here to help', icon: 'help', go: () => showToast('Support: hello@agilam.in') },
  ];

  // Log out returns to the public buyer app.
  const logout = async () => {
    if (session) await signOut();
    clearGuest();
    navigate('/buyer/home', { replace: true });
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:24px;')}>
      <div style={css('max-width:720px;margin:0 auto;')}>
        {/* Identity header */}
        <div style={css('background:linear-gradient(150deg,#8E1C44,#B02454 55%,#D6336C);padding:26px 20px 40px;color:#fff;border-radius:0 0 28px 28px;position:relative;overflow:hidden;box-shadow:0 22px 44px -30px rgba(142,28,68,.9);')}>
          <div style={css('position:absolute;top:-70px;right:-40px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(244,217,166,.22),transparent 70%);')} />
          <div className="agx-eyebrow" style={css('font-size:10px;color:#F4D9A6;position:relative;')}>My account</div>
          <div style={css('display:flex;align-items:center;gap:15px;margin-top:12px;position:relative;')}>
            <div style={css("width:66px;height:66px;flex:none;border-radius:20px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:30px;backdrop-filter:blur(4px);")}>
              {initial || <span style={css("font-family:'Material Symbols Outlined';font-size:34px;opacity:.9;")}>person</span>}
            </div>
            <div style={css('flex:1;min-width:0;')}>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{name}</div>
              <div style={css('opacity:.88;font-size:13px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{subline}</div>
            </div>
            <button
              onClick={() => (guestNoAccount ? setAccountOpen(true) : setEditing(true))}
              style={css('flex:none;height:38px;padding:0 15px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.14);color:#fff;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;')}
            >
              <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>{guestNoAccount ? 'login' : 'edit'}</span>
              {guestNoAccount ? 'Sign in' : 'Edit'}
            </button>
          </div>
        </div>

        {/* Live stats */}
        <div style={css('margin:-24px 20px 0;background:#fff;border-radius:20px;padding:6px;display:flex;box-shadow:0 16px 36px -26px rgba(107,20,54,.6);position:relative;')}>
          {stats.map((s, i) => (
            <button
              key={s.label}
              onClick={s.go}
              style={css(`flex:1;background:none;border:none;cursor:pointer;padding:14px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;${i < stats.length - 1 ? 'border-right:1px solid #F4E6EC;' : ''}`)}
            >
              <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:22px;")}>{s.icon}</span>
              <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;color:#241019;line-height:1;")}>{s.value}</span>
              <span style={css('font-size:11.5px;font-weight:700;color:#8A7078;')}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Account / cross-device sync */}
        {signedIn ? (
          <div style={css('margin:16px 20px 0;display:flex;align-items:center;gap:13px;padding:14px 15px;background:linear-gradient(135deg,#EAF7F0,#F1FBF5);border:1px solid #CDEBDB;border-radius:18px;')}>
            <span style={css('width:40px;height:40px;flex:none;border-radius:12px;background:#D6F0E1;display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#2FA36B;font-size:22px;")}>verified</span>
            </span>
            <span style={css('flex:1;min-width:0;')}>
              <span style={css('display:block;font-weight:800;font-size:14.5px;color:#1E7A4E;')}>Synced across devices</span>
              <span style={css('display:block;font-size:12px;color:#4E8C6E;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{accountEmail || 'Orders & profile backed up'}</span>
            </span>
            <button onClick={() => void doSync()} disabled={syncing} style={css('flex:none;height:34px;padding:0 13px;border:1px solid #B9E3CD;background:#fff;color:#1E7A4E;border-radius:10px;font-weight:800;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:5px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:16px;")}>{syncing ? 'sync' : 'refresh'}</span>{syncing ? 'Syncing' : 'Refresh'}
            </button>
          </div>
        ) : (
          <button onClick={() => setAccountOpen(true)} style={css('margin:16px 20px 0;width:calc(100% - 40px);display:flex;align-items:center;gap:13px;padding:14px 15px;background:#fff;border:1.5px dashed #E7B7CB;border-radius:18px;cursor:pointer;text-align:left;box-shadow:0 12px 30px -24px rgba(107,20,54,.55);')}>
            <span style={css('width:40px;height:40px;flex:none;border-radius:12px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:22px;")}>cloud_sync</span>
            </span>
            <span style={css('flex:1;min-width:0;')}>
              <span style={css('display:block;font-weight:800;font-size:14.5px;color:#241019;')}>Sign in to sync</span>
              <span style={css('display:block;font-size:12px;color:#9A8088;margin-top:1px;')}>Google or email to back up orders &amp; details</span>
            </span>
            <span style={css("font-family:'Material Symbols Outlined';color:#B02454;flex:none;")}>chevron_right</span>
          </button>
        )}

        {/* Menu */}
        <div style={css('margin:16px 20px 0;background:#fff;border-radius:20px;padding:6px;box-shadow:0 12px 30px -22px rgba(107,20,54,.55);')}>
          {rows.map((r, i) => (
            <button
              key={r.label}
              onClick={r.go}
              style={css(`width:100%;display:flex;align-items:center;gap:13px;padding:13px 12px;border:none;background:none;cursor:pointer;text-align:left;${i < rows.length - 1 ? 'border-bottom:1px solid #F5E4EC;' : ''}`)}
            >
              <span style={css('width:40px;height:40px;flex:none;border-radius:12px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}>
                <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:21px;")}>{r.icon}</span>
              </span>
              <span style={css('flex:1;min-width:0;')}>
                <span style={css('display:block;font-weight:800;font-size:14.5px;color:#241019;')}>{r.label}</span>
                <span style={css('display:block;font-size:12px;color:#9A8088;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{r.sub}</span>
              </span>
              <span style={css("font-family:'Material Symbols Outlined';color:#CBB0BC;flex:none;")}>chevron_right</span>
            </button>
          ))}
        </div>

        {/* Sell CTA */}
        <button onClick={openSellModal} style={css('margin:16px 20px 0;width:calc(100% - 40px);display:flex;align-items:center;gap:13px;padding:15px;border:none;border-radius:18px;background:linear-gradient(135deg,#8E1C44,#B02454);color:#fff;cursor:pointer;box-shadow:0 16px 34px -18px rgba(142,28,68,.9);text-align:left;')}>
          <span style={css('width:42px;height:42px;border-radius:13px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex:none;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:23px;")}>storefront</span>
          </span>
          <span style={css('flex:1;')}>
            <span style={css('display:block;font-weight:800;font-size:15px;')}>Sell on Agilam</span>
            <span style={css('display:block;font-size:12.5px;opacity:.85;margin-top:2px;')}>Open your boutique &amp; start selling</span>
          </span>
          <span style={css("font-family:'Material Symbols Outlined';opacity:.8;")}>chevron_right</span>
        </button>

        <button onClick={logout} style={css('margin:16px 20px 0;width:calc(100% - 40px);height:50px;border:1.5px solid #F0D8E2;background:#fff;color:#D6455A;border-radius:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:19px;")}>logout</span>Log out
        </button>

        <button onClick={() => navigate('/admin/login')} style={css('margin:12px 20px 0;width:calc(100% - 40px);height:42px;border:none;background:none;color:#B79AA6;font-size:12.5px;font-weight:700;letter-spacing:.04em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>shield_person</span>Admin login · internal use
        </button>
      </div>

      {editing && (
        <ProfileEditSheet
          onClose={() => setEditing(false)}
          onSaved={(patch) => { if (signedIn) void doSync(patch); }}
        />
      )}
      {accountOpen && <AccountSheet onDone={onSignedIn} onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
