import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchSubscriptionForBoutique, upgradeToFeatured } from '@/data/subscriptions';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const FEATURES = ['Unlimited product listings', 'Direct customer chat + WhatsApp', 'Order & inventory management', 'Monthly earnings reports'];

export function Subscription() {
  const navigate = useNavigate();
  const toast = useToast();
  const { boutique } = useMyBoutique();
  const { data: sub, reload } = useAsync(() => (boutique ? fetchSubscriptionForBoutique(boutique.id) : Promise.resolve(null)), [boutique?.id]);

  async function handleUpgrade() {
    if (!boutique) return;
    await upgradeToFeatured(boutique.id);
    toast('Featured upgrade started');
    reload();
  }

  return (
    <div className="min-h-full bg-rose-card pb-6">
      <ScreenHeader title="Subscription" onBack={() => navigate('/seller/profile')} size={24} />
      <div className="mx-5 rounded-[20px] bg-white p-4.5 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-extrabold">Boutique Plan</div>
          <span className="rounded-lg bg-good/10 px-2.5 py-1 text-[11px] font-extrabold text-good" style={{ background: '#E5F3EC' }}>
            {(sub?.status ?? 'active').toUpperCase()}
          </span>
        </div>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="font-serif text-[40px] font-bold">₹{sub?.price ?? 299}</span>
          <span className="font-bold text-rose-muted">/ account</span>
        </div>
        <div className="mt-0.5 text-[13px] text-rose-muted">
          {sub?.renewal_date ? `Renews ${new Date(sub.renewal_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Renews monthly'}
        </div>
        <div className="mt-3.5 flex flex-col gap-2">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2 text-[13.5px] font-semibold text-[#4B3840]">
              <Icon name="check_circle" className="text-lg" style={{ color: '#2FA36B' }} />
              {f}
            </div>
          ))}
        </div>
      </div>

      {sub?.plan !== 'featured' && (
        <div
          className="mx-5 mt-3.5 rounded-[20px] p-4.5 text-white shadow-[0_16px_36px_-22px_rgba(158,117,36,.9)]"
          style={{ background: 'linear-gradient(150deg,#C99A3F,#9E7524)' }}
        >
          <div className="flex items-center gap-2">
            <Icon name="workspace_premium" />
            <span className="text-[15px] font-extrabold">Upgrade to Featured</span>
          </div>
          <div className="mt-1.5 text-[13px] leading-relaxed opacity-90">
            Get a gold badge, priority placement in search and a spot on the Home hero carousel.
          </div>
          <button onClick={handleUpgrade} className="mt-3.5 rounded-xl border-none bg-white px-4.5 py-2.5 text-sm font-extrabold text-[#8A6420]">
            Upgrade · ₹799/mo
          </button>
        </div>
      )}
    </div>
  );
}
