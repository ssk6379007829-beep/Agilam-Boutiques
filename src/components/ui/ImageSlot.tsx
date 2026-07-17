import type { CSSProperties } from 'react';
import { css } from '@/lib/css';

/**
 * Stand-in for the design's `<x-import component="image-slot">` elements.
 *
 * The design file ships no bound photography — each slot renders as an empty
 * tinted placeholder over its parent's tone colour. This mirrors that: it
 * occupies the same box so surrounding layout is unchanged, and shows a soft
 * label until real imagery is wired up.
 */
export function ImageSlot({
  placeholder,
  style,
  className = '',
}: {
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        ...css('display:flex;align-items:center;justify-content:center;overflow:hidden;'),
        ...style,
      }}
      aria-label={placeholder}
    >
      <span
        style={css(
          "font-family:'Material Symbols Outlined';font-size:34px;color:rgba(107,20,54,.16);",
        )}
      >
        image
      </span>
    </div>
  );
}
