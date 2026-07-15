import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

export function Profile() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const toast = useToast();

  const rows = [
    { label: 'My Orders', icon: 'receipt_long', go: () => toast('My Orders') },
    { label: 'Wishlist', icon: 'favorite', go: () => navigate('/buyer/wishlist') },
    { label: 'Addresses', icon: 'location_on', go: () => toast('Addresses') },
    { label: 'Payment Methods', icon: 'credit_card', go: () => toast('Payment Methods') },
    { label: 'Settings', icon: 'settings', go: () => toast('Settings') },
    { label: 'Help & Support', icon: 'help', go: () => toast('Help & Support') },
  ];

  return (
    <div className="min-h-full bg-rose-card pb-5">
      <div className="px-5 pb-7.5 pt-6 text-white" style={{ background: 'linear-gradient(150deg,#D6336C,#B02454)' }}>
        <div className="flex items-center gap-3.5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/20 font-serif text-[28px] font-bold">
            {profile?.full_name?.[0] ?? 'B'}
          </div>
          <div>
            <div className="font-serif text-2xl font-bold">{profile?.full_name}</div>
            <div className="text-[13px] opacity-85">
              {profile?.phone} · {profile?.city}
            </div>
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
