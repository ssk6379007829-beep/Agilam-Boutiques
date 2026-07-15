import type { CSSProperties } from 'react';

export function Icon({ name, className = '', style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`msymbol ${className}`} style={style}>
      {name}
    </span>
  );
}
