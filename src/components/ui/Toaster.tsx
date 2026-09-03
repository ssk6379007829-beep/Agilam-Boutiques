import { useShop, type ToastTone } from '@/state/ShopContext';
import { css } from '@/lib/css';

/**
 * The one place a toast is drawn.
 *
 * There used to be two toast systems and two renderers. `ShopContext` carried
 * the toned one, drawn twice — once in `AppShell`, once in `AdminLayout`, in
 * copy-pasted markup that had already drifted (the storefront showed
 * `check_circle` for a non-error, the console showed `info`). A second,
 * tone-less `ToastProvider` sat at the root and drew a pink tick over
 * everything it was given, including "Sign in failed".
 *
 * That second system existed for a real reason, and it is the reason this
 * component is mounted at the ROOT rather than inside a shell: the auth screens
 * and the admin login sit outside both layouts, so a renderer living in either
 * one would silently swallow every message they raise.
 */

/** Per-tone fill, foreground and glyph. Tokens only — a literal hex here would
 *  come out unreadable in dark mode, and these four pairs are already defined
 *  in all three themes (light, dark, and the `/sell` ledger theme). */
const TONE: Record<ToastTone, { bg: string; fg: string; icon: string }> = {
  success: { bg: 'var(--ag-good-bg)', fg: 'var(--ag-good-text)', icon: 'check_circle' },
  // `--ag-danger-text`, not `--ag-bad-text`: the latter is #C0392B, which lands
  // at 4.45:1 on its own --ag-bad-bg — under AA for 14px text, and this is the
  // tone carrying the messages that most need reading. --ag-danger-text is the
  // readable counterpart the theme already defines for exactly this, and clears
  // AA in all three themes (5.57 light, 7.13 dark, 5.81 on /sell).
  error: { bg: 'var(--ag-bad-bg)', fg: 'var(--ag-danger-text)', icon: 'error' },
  warning: { bg: 'var(--ag-warn-bg)', fg: 'var(--ag-warn-text)', icon: 'warning' },
  info: { bg: 'var(--ag-info-bg)', fg: 'var(--ag-info-text)', icon: 'info' },
};

export function Toaster() {
  const { toast } = useShop();
  if (!toast) return null;

  const tone = TONE[toast.tone] ?? TONE.success;

  return (
    <div
      className="agx-toast"
      // `alert` is announced immediately and interrupts; `status` waits for a
      // pause. A failure the buyer has to act on earns the interruption, a
      // confirmation does not.
      role={toast.tone === 'error' || toast.tone === 'warning' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' || toast.tone === 'warning' ? 'assertive' : 'polite'}
      style={css(
        `position:fixed;left:50%;transform:translateX(-50%);max-width:min(420px,calc(100vw - 32px));` +
          `background:${tone.bg};color:${tone.fg};border:1px solid ${tone.fg};` +
          `padding:13px 18px;border-radius:14px;font-weight:600;font-size:14px;` +
          `box-shadow:0 16px 40px -14px var(--ag-shadow);z-index:1400;` +
          `display:flex;align-items:center;gap:10px;animation:agx-fade .2s ease;`,
      )}
    >
      {/* The glyph repeats what the fill already says, for anyone who cannot
          tell the fills apart — colour is never the only channel. */}
      <span
        aria-hidden="true"
        translate="no"
        style={css(`font-family:'Material Symbols Outlined';font-size:20px;flex:none;line-height:1;`)}
      >
        {tone.icon}
      </span>
      {toast.msg}
    </div>
  );
}
