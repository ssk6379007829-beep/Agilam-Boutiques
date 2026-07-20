import type { CSSProperties } from 'react';

/**
 * Material Symbols glyph. Icons are decorative by default: `aria-hidden` keeps
 * screen readers from announcing the ligature text (e.g. "arrow_back"), and
 * `translate="no"` stops browser auto-translation from corrupting the ligature.
 * Pass `label` when the icon is the ONLY content of an interactive control so it
 * still exposes an accessible name.
 */
export function Icon({
  name,
  className = '',
  style,
  label,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  return (
    <span
      className={`msymbol ${className}`}
      style={style}
      translate="no"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {name}
    </span>
  );
}
