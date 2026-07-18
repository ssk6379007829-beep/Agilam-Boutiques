import { useState, type ReactNode } from 'react';
import { css } from '@/lib/css';

export type LoginRole = 'buyer' | 'seller' | 'admin';

const ROLE_OPTS: { key: LoginRole; label: string; icon: string }[] = [
  { key: 'buyer', label: 'Buyer', icon: 'shopping_bag' },
  { key: 'seller', label: 'Seller', icon: 'storefront' },
  { key: 'admin', label: 'Admin', icon: 'shield_person' },
];

/**
 * Shared auth popup panel — the same centred white card as the
 * "Are you a Boutique Owner?" sheet (see SellModal), reused across every auth
 * screen (sign in, create account, OTP) so they read as one consistent popup.
 */
export function AuthModal({
  icon = 'storefront',
  heading,
  sub,
  onBack,
  children,
}: {
  icon?: string;
  heading: string;
  sub: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div style={css('position:fixed;inset:0;z-index:50;background:radial-gradient(125% 78% at 50% 0%,#F6DCE6 0%,#FBF6F2 58%);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;')}>
      <div style={css('width:100%;max-width:460px;background:#fff;border-radius:28px;padding:22px 26px 30px;box-shadow:0 30px 80px -30px rgba(107,20,54,.6);border:1px solid #F6E3EC;margin:auto;')}>
        {onBack && (
          <button
            onClick={onBack}
            style={css('border:none;background:#FBF1F5;width:40px;height:40px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;')}
          >
            <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
          </button>
        )}

        <div style={css('width:58px;height:58px;border-radius:18px;background:linear-gradient(135deg,#D6336C,#B02454);display:flex;align-items:center;justify-content:center;margin:14px auto 0;box-shadow:0 16px 34px -16px rgba(214,51,108,.8);')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:30px;")}>{icon}</span>
        </div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;text-align:center;margin-top:16px;line-height:1.1;")}>{heading}</div>
        <div style={css('text-align:center;color:#8A7078;font-size:14px;margin-top:9px;line-height:1.55;max-width:340px;margin-left:auto;margin-right:auto;')}>{sub}</div>

        <div style={css('display:flex;flex-direction:column;gap:15px;margin-top:22px;')}>{children}</div>
      </div>
    </div>
  );
}

/** Buyer / Seller / Admin selector, shown inside the auth popup. */
export function RoleTabs({ role, onRoleChange }: { role: LoginRole; onRoleChange: (r: LoginRole) => void }) {
  return (
    <div>
      <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;')}>Choose your role</div>
      <div style={css('display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;')}>
        {ROLE_OPTS.map((r) => {
          const on = role === r.key;
          return (
            <button
              key={r.key}
              onClick={() => onRoleChange(r.key)}
              style={css(`display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:72px;border-radius:15px;cursor:pointer;font-family:inherit;border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : '#fff'};color:${on ? '#B02454' : '#7A5C67'};box-shadow:${on ? '0 12px 26px -16px rgba(214,51,108,.85)' : 'none'};`)}
            >
              <span style={css("font-family:'Material Symbols Outlined';font-size:23px;")}>{r.icon}</span>
              <span style={css('font-size:13px;font-weight:800;')}>{r.label}</span>
            </button>
          );
        })}
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
