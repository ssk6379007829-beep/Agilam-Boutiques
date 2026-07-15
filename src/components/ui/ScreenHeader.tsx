import type { ReactNode } from 'react';
import { IconButton } from './IconButton';

export function ScreenHeader({ title, onBack, action, size = 26 }: { title: ReactNode; onBack?: () => void; action?: ReactNode; size?: number }) {
  return (
    <div className="flex items-center justify-between gap-2.5 px-5 pb-3 pt-1.5">
      <div className="flex items-center gap-2.5">
        {onBack && <IconButton icon="arrow_back" onClick={onBack} />}
        <div className="font-serif font-bold leading-none" style={{ fontSize: size }}>
          {title}
        </div>
      </div>
      {action}
    </div>
  );
}
