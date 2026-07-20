import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'plain' | 'danger';
  full?: boolean;
  loading?: boolean;
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold cursor-pointer transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
    />
  );
}

export function Button({
  variant = 'primary',
  full,
  loading = false,
  type = 'button',
  disabled,
  children,
  className = '',
  style,
  ...rest
}: Props) {
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
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variantClass} ${full ? 'w-full' : ''} h-[52px] px-5 text-[15px] ${className}`}
      style={{ ...bgStyle, ...style }}
      {...rest}
    >
      {loading && <Spinner />}
      {children as ReactNode}
    </button>
  );
}
