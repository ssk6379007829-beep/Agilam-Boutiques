import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const FAQS = [
  'How do I add a new product?',
  'When do I receive payouts?',
  'How does the ₹299 plan work?',
  'How do I get the Verified badge?',
];

export function Help() {
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <div className="min-h-full bg-rose-card pb-6">
      <ScreenHeader title="Help & Support" onBack={() => navigate('/seller/profile')} size={24} />
      <div className="mx-5 overflow-hidden rounded-2xl bg-white shadow-soft">
        {FAQS.map((q, i) => (
          <div
            key={q}
            className="flex cursor-pointer items-center gap-2.5 px-3.5 py-4"
            style={{ borderBottom: i === FAQS.length - 1 ? 'none' : '1px solid #F5E4EC' }}
          >
            <Icon name="help" className="text-xl" style={{ color: '#D6336C' }} />
            <span className="flex-1 text-[13.5px] font-bold">{q}</span>
            <Icon name="expand_more" style={{ color: '#CBB0BC' }} />
          </div>
        ))}
      </div>
      <button
        onClick={() => toast('Connecting you to support…')}
        className="mx-5 mt-4 flex h-[52px] w-[calc(100%-40px)] items-center justify-center gap-2 rounded-2xl border-none font-extrabold text-white"
        style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
      >
        <Icon name="support_agent" />
        Contact Support
      </button>
    </div>
  );
}
