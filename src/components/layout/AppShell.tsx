import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useAuth } from '@/auth/AuthContext';
import { SellModal } from '@/components/SellModal';
import { initialsFrom, resolveDisplayName } from '@/lib/displayName';

/**
 * Premium header profile button — shows the user's initials in a gradient
 * avatar (falling back to an icon before they've told us their name). Reused
 * for the desktop and mobile header slots.
 */
function ProfileAvatar({ initials, onClick, className }: { initials: string; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={className}
      style={css('width:44px;height:44px;flex:none;border-radius:14px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#E14A7E,#B02454 70%,#8E1C44);color:#fff;box-shadow:0 1px 0 rgba(255,255,255,.35) inset,0 12px 26px -12px rgba(176,36,84,.9);')}
    >
      {initials ? (
        <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:16px;letter-spacing:.02em;")}>{initials}</span>
      ) : (
        <span style={css("font-family:'Material Symbols Outlined';font-size:24px;")}>person</span>
      )}
    </button>
  );
}

export type TabDef = {
  label: string;
  icon: string;
  to: string;
  /** Route prefixes that keep this tab highlighted. */
  match: string[];
  badge?: number;
};

function Tab({ tab, active, onClick }: { tab: TabDef; active: boolean; onClick: () => void }) {
  const hasBadge = !!tab.badge;
  return (
    <button
      onClick={onClick}
      style={css(
        `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:68px;border:1px solid ${active ? 'rgba(255,255,255,.28)' : 'transparent'};cursor:pointer;padding:10px 16px;border-radius:20px;font-family:inherit;white-space:nowrap;background:${active ? 'linear-gradient(140deg,#E14A7E,#B02454 70%,#8E1C44)' : 'transparent'};color:${active ? '#fff' : '#9A8189'};box-shadow:${active ? '0 1px 0 rgba(255,255,255,.35) inset,0 12px 24px -10px rgba(176,36,84,.9)' : 'none'};transform:${active ? 'translateY(-2px)' : 'none'};transition:transform .28s cubic-bezier(.2,.7,.2,1),background .28s ease,color .28s ease,box-shadow .28s ease;`,
      )}
    >
      <span style={css('position:relative;display:inline-flex;')}>
        <span style={css("font-family:'Material Symbols Outlined';font-size:23px;")}>{tab.icon}</span>
        {hasBadge && (
          <span style={css('position:absolute;top:-6px;right:-10px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#D6336C;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;')}>
            {tab.badge}
          </span>
        )}
      </span>
      <span style={css('font-size:11px;font-weight:700;')}>{tab.label}</span>
    </button>
  );
}

export function AppShell({ tabs, profileTo }: { tabs: TabDef[]; profileTo: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { toast, sellModal, guest } = useShop();
  const { profile, session } = useAuth();
  // Resolve a display name for the avatar initials from the signed-in account,
  // so a signed-in user always gets initials instead of the fallback icon.
  const initials = initialsFrom(resolveDisplayName(profile, session, guest.name));

  return (
    <div style={css('min-height:100vh;background:#FBF6F2;')}>
      {sellModal && <SellModal />}

      <div style={css('min-height:100vh;display:flex;flex-direction:column;background:#FBF6F2;')}>
        <header style={css('position:sticky;top:0;z-index:30;background:rgba(251,246,242,.88);backdrop-filter:blur(14px);border-bottom:1px solid #EFDCE4;')}>
          <div className="agx-app agx-app-header" style={css('display:flex;align-items:center;gap:20px;padding:14px 16px;')}>
            <button
              onClick={() => navigate(profileTo)}
              style={css('display: flex; align-items: center; gap: 11px; border: none; background: none; cursor: pointer; padding: 0; width: 249px; height: 48px')}
            >
              <img
                src="/agilam-wordmark.png"
                alt="Agilam Boutiques"
                style={css('width: 128px; height: 50px; border-radius: 13px; object-fit: contain')}
              />
              <div className="agx-hide-sm" style={css('text-align:left;')} />
            </button>

            <div style={css('flex:1;')} />

            <div
              className="agx-only-desktop"
              style={css('align-items:center;gap:8px;background:#fff;border:1px solid #EFDCE4;border-radius:14px;padding:0 14px;height:44px;width:260px;box-shadow:0 8px 22px -18px rgba(107,20,54,.6);')}
            >
              <span style={css("font-family:'Material Symbols Outlined';color:#B79AA6;font-size:20px;")}>search</span>
              <input
                placeholder="Search boutiques &amp; styles"
                style={css('border:none;background:none;flex:1;font-size:13.5px;font-weight:600;color:#241019;min-width:0;')}
              />
            </div>

            <ProfileAvatar initials={initials} onClick={() => navigate(profileTo)} className="agx-only-desktop" />

            {/* Mobile profile — the desktop search/profile are hidden below 960px. */}
            <ProfileAvatar initials={initials} onClick={() => navigate(profileTo)} className="agx-only-mobile" />
          </div>

          {/* Mobile search row — below the logo/profile row, full width. */}
          <div className="agx-only-mobile agx-app-header" style={css('padding:0 16px 12px;')}>
            <div style={css('flex:1;display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #EFDCE4;border-radius:14px;padding:0 14px;height:44px;box-shadow:0 8px 22px -18px rgba(107,20,54,.6);')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#B79AA6;font-size:20px;")}>search</span>
              <input
                placeholder="Search boutiques &amp; styles"
                style={css('border:none;background:none;flex:1;font-size:13.5px;font-weight:600;color:#241019;min-width:0;')}
              />
            </div>
          </div>
        </header>

        <main className="agx-app agx-app-main" style={css('flex:1;width:100%;padding:16px 18px 128px;')}>
          <Outlet />
        </main>

        <div
          className="agx-dock"
          style={css('position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:50;display:flex;gap:5px;background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(251,246,242,.9));backdrop-filter:blur(22px) saturate(1.3);border:1px solid rgba(255,255,255,.7);border-radius:28px;padding:8px;box-shadow:0 2px 0 rgba(255,255,255,.6) inset,0 1px 3px rgba(107,20,54,.1),0 26px 60px -20px rgba(107,20,54,.55);animation:agx-sheet .35s ease;')}
        >
          {tabs.map((t) => (
            <Tab
              key={t.label}
              tab={t}
              active={t.match.some((m) => pathname.startsWith(m))}
              onClick={() => navigate(t.to)}
            />
          ))}
        </div>
      </div>

      {toast && (
        <div style={css('position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#2A1A20;color:#fff;padding:13px 22px;border-radius:14px;font-weight:600;font-size:14px;box-shadow:0 16px 40px -14px rgba(0,0,0,.6);z-index:999;display:flex;align-items:center;gap:10px;animation:agx-fade .2s ease;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#F7B7CF;font-size:20px;")}>check_circle</span>
          {toast}
        </div>
      )}
    </div>
  );
}
