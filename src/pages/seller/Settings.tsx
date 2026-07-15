import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';

const DEFAULTS = [
  { key: 'push', label: 'Push notifications', icon: 'notifications', on: true },
  { key: 'orderAlerts', label: 'Order alerts', icon: 'shopping_bag', on: true },
  { key: 'whatsapp', label: 'WhatsApp sync', icon: 'chat_bubble', on: true },
  { key: 'publicProfile', label: 'Show boutique publicly', icon: 'visibility', on: true },
  { key: 'darkMode', label: 'Dark mode', icon: 'dark_mode', on: false },
];

export function Settings() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(DEFAULTS);

  function toggle(key: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, on: !r.on } : r)));
  }

  return (
    <div className="min-h-full bg-rose-card pb-6">
      <ScreenHeader title="Settings" onBack={() => navigate('/seller/profile')} />
      <div className="mx-5 overflow-hidden rounded-2xl bg-white shadow-soft">
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="flex items-center gap-3.5 px-3.5 py-4"
            style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid #F5E4EC' }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-rose-chip">
              <Icon name={r.icon} className="text-[19px]" style={{ color: '#D6336C' }} />
            </span>
            <span className="flex-1 text-sm font-bold">{r.label}</span>
            <button
              onClick={() => toggle(r.key)}
              className="relative h-[26px] w-11 rounded-full border-none"
              style={{ background: r.on ? '#2FA36B' : '#E0CDD6' }}
            >
              <span
                className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all"
                style={{ left: r.on ? 23 : 3 }}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
