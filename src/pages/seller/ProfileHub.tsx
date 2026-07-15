import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { Icon } from '@/components/ui/Icon';

export function ProfileHub() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { boutique } = useMyBoutique();

  const rows = [
    { label: 'Earnings', icon: 'payments', go: () => navigate('/seller/earnings') },
    { label: 'Boutique Profile', icon: 'store', go: () => navigate('/seller/boutique') },
    { label: 'Subscription', icon: 'workspace_premium', go: () => navigate('/seller/subscription') },
    { label: 'Customers', icon: 'group', go: () => navigate('/seller/customers') },
    { label: 'Notifications', icon: 'notifications', go: () => navigate('/seller/notifications') },
    { label: 'Settings', icon: 'settings', go: () => navigate('/seller/settings') },
    { label: 'Help & Support', icon: 'help', go: () => navigate('/seller/help') },
  ];

  if (!boutique) return null;

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="px-5 pb-7.5 pt-6 text-white" style={{ background: 'linear-gradient(150deg,#D6336C,#B02454)' }}>
        <div className="flex items-center gap-3.5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/20 font-serif text-[28px] font-bold">
            {boutique.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-[23px] font-bold">{boutique.name}</span>
              {boutique.verified && <Icon name="verified" className="text-[17px]" />}
            </div>
            <div className="text-[13px] opacity-85">{boutique.city}</div>
          </div>
        </div>
      </div>
      <div className="mx-5 -mt-4 rounded-[18px] bg-white p-1.5 shadow-soft">
        {rows.map((r, i) => (
          <button
            key={r.label}
            onClick={r.go}
            className="flex w-full items-center gap-3.5 border-none bg-transparent px-3 py-3.5 text-left"
            style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid #F5E4EC' }}
          >
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-rose-chip">
              <Icon name={r.icon} className="text-xl" style={{ color: '#D6336C' }} />
            </span>
            <span className="flex-1 text-[14.5px] font-bold">{r.label}</span>
            <Icon name="chevron_right" style={{ color: '#CBB0BC' }} />
          </button>
        ))}
      </div>
      <button
        onClick={() => signOut()}
        className="mx-5 mt-4 h-[50px] w-[calc(100%-40px)] rounded-2xl border-[1.5px] border-rose-border bg-white font-extrabold text-rose-danger"
      >
        Log out
      </button>
    </div>
  );
}
