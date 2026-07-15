import type { CSSProperties } from 'react';
import { initial } from '@/lib/tokens';

export function Avatar({
  name,
  size = 44,
  radius = 14,
  tone = '#F4D6E2',
  fontSize,
  style,
}: {
  name: string;
  size?: number;
  radius?: number;
  tone?: string;
  fontSize?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="flex flex-none items-center justify-center font-serif font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: tone,
        color: 'rgba(42,26,32,.55)',
        fontSize: fontSize ?? size * 0.42,
        ...style,
      }}
    >
      {initial(name)}
    </div>
  );
}
