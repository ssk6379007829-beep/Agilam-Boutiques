import { useState, type CSSProperties } from 'react';
import { css } from '@/lib/css';

/**
 * Stand-in for the design's `<x-import component="image-slot">` elements.
 *
 * When a `src` is supplied (demo imagery), it renders a cover-fit photo over
 * the parent's tone colour and falls back to the tinted placeholder if the
 * image fails to load. Without a `src` it behaves as before: an empty tinted
 * placeholder that occupies the same box so surrounding layout is unchanged.
 */
export function ImageSlot({
  placeholder,
  src,
  alt,
  style,
  className = '',
}: {
  placeholder?: string;
  src?: string;
  alt?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={className}
      style={{
        ...css('display:flex;align-items:center;justify-content:center;overflow:hidden;'),
        ...style,
      }}
      aria-label={alt ?? placeholder}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? placeholder ?? ''}
          loading="lazy"
          onError={() => setFailed(true)}
          style={css('width:100%;height:100%;object-fit:cover;display:block;')}
        />
      ) : (
        <span
          style={css(
            "font-family:'Material Symbols Outlined';font-size:34px;color:rgba(107,20,54,.16);",
          )}
        >
          image
        </span>
      )}
    </div>
  );
}
