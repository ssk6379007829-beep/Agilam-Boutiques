import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'plain' | 'danger';
  full?: boolean;
};

const base = 'rounded-2xl font-extrabold cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed';

export function Button({ variant = 'primary', full, className = '', style, ...rest }: Props) {
  const variantClass =
    variant === 'primary'
      ? 'text-white border-none shadow-button'
      : variant === 'outline'
      ? 'bg-white border-[1.5px] border-rose-primary text-rose-primaryDark'
      : variant === 'danger'
      ? 'bg-white border-[1.5px] border-rose-dangerBorder text-rose-danger'
      : 'bg-transparent border-none text-rose-primaryDark';

  const bgStyle = variant === 'primary' ? { background: 'linear-gradient(135deg,#D6336C,#B02454)' } : {};

  return (
    <button
      className={`${base} ${variantClass} ${full ? 'w-full' : ''} h-[52px] px-5 text-[15px] ${className}`}
      style={{ ...bgStyle, ...style }}
      {...rest}
    />
  );
}
