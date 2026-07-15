import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  size?: number;
  iconSize?: number;
  color?: string;
  bg?: string;
};

export function IconButton({ icon, size = 42, iconSize = 20, color = '#B02454', bg = '#fff', className = '', style, ...rest }: Props) {
  return (
    <button
      className={`flex items-center justify-center rounded-xl border-none cursor-pointer shadow-raised ${className}`}
      style={{ width: size, height: size, background: bg, ...style }}
      {...rest}
    >
      <Icon name={icon} style={{ color, fontSize: iconSize }} />
    </button>
  );
}
