import { css } from '@/lib/css';

/**
 * "We couldn't load this" — the console's one shape for a failed foreground
 * fetch.
 *
 * `useAsync` distinguishes a foreground failure (which sets `error`) from a
 * background refresh failure (which stays silent and keeps the last good data
 * on screen). Only the first is worth interrupting anyone for, so this is what
 * a page renders when `error` is set.
 *
 * It exists because the console used to drop `error` at 27 of its 28 call
 * sites, which meant a failed load fell through to the empty state and a
 * seller saw "₹0" where the real answer was "we don't know". A wrong number is
 * worse than a missing one — especially when the number is their revenue.
 *
 * Ported from the block Coupons.tsx already used, which was the only page
 * doing this correctly.
 */
export function LoadError({
  title,
  detail,
  onRetry,
  icon = 'error_outline',
}: {
  /** What failed, in the seller's words: "Couldn't load your orders". */
  title: string;
  /**
   * The reassurance. Money and stock are the two things a seller will assume
   * they have lost when a screen goes blank, so say plainly that they haven't.
   */
  detail: string;
  onRetry?: () => void;
  icon?: string;
}) {
  return (
    <div
      role="alert"
      style={css('background:var(--ag-bad-bg);border:1.5px solid var(--ag-bad-text);border-radius:18px;padding:20px 18px;text-align:center;')}
    >
      <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:30px;color:var(--ag-bad-text);")}>{icon}</span>
      <div style={css('font-weight:800;font-size:14.5px;color:var(--ag-bad-text);margin-top:6px;')}>{title}</div>
      <div style={css('color:var(--ag-label);font-size:12.5px;margin-top:4px;line-height:1.5;')}>{detail}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={css('margin-top:12px;min-height:44px;padding:0 18px;border:1.5px solid var(--ag-bad-text);background:var(--ag-surface);color:var(--ag-bad-text);border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;')}
        >
          Retry
        </button>
      )}
    </div>
  );
}
