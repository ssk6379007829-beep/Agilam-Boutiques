import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchNotifications, markNotificationRead } from '@/data/notifications';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';

const TABS = ['All', 'Orders', 'Messages', 'Updates'];
const TINT: Record<string, { tint: string; ic: string; icon: string }> = {
  Orders: { tint: '#FCE0EC', ic: '#D6336C', icon: 'shopping_bag' },
  Messages: { tint: '#E6F0FA', ic: '#3A6EA5', icon: 'chat_bubble' },
  Updates: { tint: '#E5F3EC', ic: '#2FA36B', icon: 'local_shipping' },
};

export function Notifications() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: notifs, reload } = useAsync(() => (profile ? fetchNotifications(profile.id) : Promise.resolve([])), [profile?.id]);
  const [tab, setTab] = useState('All');

  const filtered = (notifs ?? []).filter((n) => tab === 'All' || n.type === tab);

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <ScreenHeader title="Notifications" onBack={() => navigate('/seller/profile')} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-2.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-none rounded-full border-none px-3.5 py-1.5 text-[12.5px] font-bold"
            style={{ background: tab === t ? '#B02454' : '#fff', color: tab === t ? '#fff' : '#6B5560' }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 px-5">
        {filtered.map((n) => {
          const style = TINT[n.type] ?? TINT.Updates;
          return (
            <div
              key={n.id}
              onClick={() => !n.read && markNotificationRead(n.id).then(reload)}
              className="flex cursor-pointer items-start gap-2.5 rounded-2xl p-3.5 shadow-card"
              style={{ background: n.read ? '#fff' : '#FFF3F8' }}
            >
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ background: style.tint }}>
                <Icon name={style.icon} className="text-xl" style={{ color: style.ic }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-extrabold">{n.title}</span>
                  <span className="text-[11px] text-rose-mutedSoft">{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-rose-muted">{n.body}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="pt-8 text-center text-sm text-rose-muted">No notifications.</div>}
      </div>
    </div>
  );
}
