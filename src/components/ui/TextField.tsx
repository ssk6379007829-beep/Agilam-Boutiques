import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type FieldProps = { label: string; children: ReactNode };

export function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-bold text-rose-fieldLabel">
      {label}
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return (
    <input
      className={`h-[50px] w-full rounded-[13px] border-[1.5px] border-rose-border bg-white px-3.5 text-sm font-semibold text-rose-text ${className}`}
      {...rest}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return (
    <textarea
      className={`w-full resize-none rounded-[13px] border-[1.5px] border-rose-border bg-white px-3.5 py-3 text-sm font-medium text-rose-text ${className}`}
      {...rest}
    />
  );
}
