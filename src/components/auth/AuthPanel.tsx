import { useState, type ReactNode } from 'react';
import { css } from '@/lib/css';

export type LoginRole = 'buyer' | 'seller' | 'admin';

const ROLE_OPTS: { key: LoginRole; label: string; icon: string }[] = [
  { key: 'buyer', label: 'Buyer', icon: 'shopping_bag' },
  { key: 'seller', label: 'Seller', icon: 'storefront' },
  { key: 'admin', label: 'Admin', icon: 'shield_person' },
];

/**
 * The design's split-panel auth screen: a brand panel on the left (hidden on
 * small screens) and the form on the right. Shared by sign in and sign up.
 */
export function AuthPanel({
  role,
  onRoleChange,
  heading,
  children,
}: {
  role: LoginRole;
  onRoleChange: (r: LoginRole) => void;
  heading: string;
  children: ReactNode;
}) {
  const loginWord = role === 'seller' ? 'boutique owner' : role === 'admin' ? 'admin' : 'buyer';

  return (
    <div style={css('min-height:100vh;display:flex;')}>
      <div className="agx-hide-sm" style={css('flex:1;background:linear-gradient(160deg,#D6336C 0%,#B02454 52%,#8E1C44 100%);color:#fff;padding:56px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;')}>
        <div style={css('position:absolute;right:-120px;top:-120px;width:360px;height:360px;border-radius:50%;background:rgba(255,255,255,.06);')} />
        <div style={css('position:absolute;left:-90px;bottom:-90px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.05);')} />

        <div style={css('position:relative;display:flex;align-items:center;gap:12px;')}>
          <img src="/agilam-logo.png" alt="Agilam Boutiques" style={css('width: 70px; height: 61px; border-radius: 14px; object-fit: contain; background: #fff; padding: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25)')} />
          <div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>Agilam Boutiques</div>
            <div style={css("font-family:'Playfair Display',serif;font-style:italic;font-size:17px;opacity:.95;")}>All Boutiques. One Place.</div>
          </div>
        </div>

        <div style={css('position:relative;')}>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(38px,4vw,54px);line-height:1.04;")}>
            Every boutique.<br />One elegant<br />marketplace.
          </div>
          <div style={css('font-size:17px;opacity:.9;margin-top:18px;max-width:430px;line-height:1.55;')}>
            Discover bridal &amp; festive wear from India&apos;s finest boutiques. Shop, chat and manage — buyers, sellers and admins, all in one place.
          </div>
          <div style={css('display:flex;gap:34px;margin-top:36px;')}>
            <div>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:30px;")}>1,200+</div>
              <div style={css('font-size:13px;opacity:.8;')}>Boutiques</div>
            </div>
            <div>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:30px;")}>48k</div>
              <div style={css('font-size:13px;opacity:.8;')}>Products</div>
            </div>
            <div>
              <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:30px;")}>15</div>
              <div style={css('font-size:13px;opacity:.8;')}>Cities</div>
            </div>
          </div>
        </div>

        <div style={css('position:relative;font-size:13px;opacity:.7;')}>Coimbatore · Tamil Nadu, India</div>
      </div>

      <div style={css('width:100%;max-width:480px;flex:none;margin:0 auto;padding:48px 36px;display:flex;flex-direction:column;justify-content:center;')}>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:38px;line-height:1.05;margin-top:16px;")}>{heading}</div>
        <div style={css('color:#8A7078;font-size:15px;margin-top:6px;')}>Sign in to continue to your {loginWord} workspace.</div>

        <div style={css('margin-top:26px;')}>
          <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.06em;text-transform:uppercase;margin-bottom:11px;')}>Choose your role</div>
          <div style={css('display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;')}>
            {ROLE_OPTS.map((r) => {
              const on = role === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => onRoleChange(r.key)}
                  style={css(`display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;height:84px;border-radius:15px;cursor:pointer;font-family:inherit;border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : '#fff'};color:${on ? '#B02454' : '#7A5C67'};box-shadow:${on ? '0 12px 26px -16px rgba(214,51,108,.85)' : 'none'};`)}
                >
                  <span style={css("font-family:'Material Symbols Outlined';font-size:25px;")}>{r.icon}</span>
                  <span style={css('font-size:13px;font-weight:800;')}>{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

/** Password field with the design's inline visibility toggle. */
export function PasswordField({ value, onChange, label = 'Password' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
      {label}
      <div style={css('display:flex;align-items:center;gap:8px;margin-top:7px;background:#fff;border:1.5px solid #F0D8E2;border-radius:14px;padding:0 15px;height:52px;')}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={css('border:none;background:none;flex:1;font-size:15px;font-weight:600;color:#2A1A20;min-width:0;')}
        />
        <span onClick={() => setShow((s) => !s)} style={css("font-family:'Material Symbols Outlined';color:#B79AA6;cursor:pointer;")}>
          {show ? 'visibility' : 'visibility_off'}
        </span>
      </div>
    </label>
  );
}
