import type { ReactNode } from 'react';
import { css } from '@/lib/css';

/**
 * The design's mobile auth artboards (sign in / create account): a centred
 * card under a logo + heading. Rendered below 720px in place of the desktop
 * split-panel — see `.agx-auth-mobile` in index.css.
 */
export function MobileAuthCard({
  heading,
  sub,
  onBack,
  showLogo = true,
  children,
}: {
  heading: string;
  sub: string;
  onBack?: () => void;
  showLogo?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={css('min-height:100vh;background:radial-gradient(125% 78% at 50% 0%,#F6DCE6 0%,#FBF6F2 58%);padding:18px 20px 44px;display:flex;flex-direction:column;align-items:center;width:100%;')}>
      <div style={css('width:100%;max-width:440px;')}>
        {onBack && (
          <button onClick={onBack} style={css('border:none;background:#fff;width:42px;height:42px;border-radius:12px;box-shadow:0 6px 18px -10px rgba(107,20,54,.5);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
          </button>
        )}

        <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:20px;')}>
          {showLogo && (
            <img src="/agilam-logo.jpg" alt="Agilam" style={css('width:72px;height:72px;border-radius:22px;object-fit:contain;background:#fff;padding:12px;box-shadow:0 18px 40px -20px rgba(107,20,54,.55);')} />
          )}
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:33px;margin-top:16px;line-height:1.05;")}>{heading}</div>
          <div style={css('color:#8A7078;font-size:14.5px;margin-top:6px;')}>{sub}</div>
        </div>

        <div style={css('margin-top:20px;background:#fff;border-radius:24px;padding:24px 22px;box-shadow:0 24px 60px -34px rgba(107,20,54,.6);border:1px solid #F6E3EC;display:flex;flex-direction:column;gap:16px;')}>
          {children}
        </div>
      </div>
    </div>
  );
}
