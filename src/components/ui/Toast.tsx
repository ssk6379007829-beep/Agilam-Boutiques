import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type ToastContextValue = { toast: (msg: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {msg && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2.5 rounded-2xl bg-rose-text px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_-14px_rgba(0,0,0,.6)] animate-fade">
          <Icon name="check_circle" className="text-[20px]" style={{ color: '#F7B7CF' }} />
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
