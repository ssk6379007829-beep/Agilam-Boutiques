import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Role } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';

export function SignUp() {
  const { role: roleParam } = useParams<{ role: string }>();
  const role = (roleParam === 'seller' ? 'seller' : 'buyer') as Role;
  const navigate = useNavigate();
  const { sendPhoneOtp } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [boutiqueName, setBoutiqueName] = useState('');
  const [sending, setSending] = useState(false);
  const roleWord = role === 'seller' ? 'boutique owner' : 'buyer';

  async function handleSignUp() {
    const fullPhone = '+91' + phone.replace(/\D/g, '');
    if (!fullName.trim()) return toast('Enter your full name');
    if (phone.replace(/\D/g, '').length < 10) return toast('Enter a valid 10-digit phone number');
    if (role === 'seller' && !boutiqueName.trim()) return toast('Enter your boutique name');

    setSending(true);
    try {
      await sendPhoneOtp(fullPhone);
      navigate('/auth/otp', {
        state: { phone: fullPhone, role, mode: 'signup', pending: { full_name: fullName, role, city, boutiqueName } },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[520px] flex-col overflow-y-auto bg-rose-card px-6 py-4 pb-9">
      <IconButton icon="arrow_back" onClick={() => navigate(`/auth/signin/${role}`)} />
      <div className="mt-5 font-serif text-[36px] font-bold leading-[1.05]">Create account</div>
      <div className="mt-1.5 text-[15px] text-rose-muted">Join as a {roleWord}</div>

      <div className="mt-5 flex flex-col gap-3.5">
        <label className="text-[13px] font-bold text-rose-fieldLabel">
          Full name
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5 h-[52px]" placeholder="Priya Sharma" />
        </label>

        <label className="text-[13px] font-bold text-rose-fieldLabel">
          Phone number
          <div className="mt-1.5 flex h-[52px] items-center gap-2 rounded-2xl border-[1.5px] border-rose-border bg-white px-3.5">
            <span className="font-bold text-rose-text">+91</span>
            <div className="h-5.5 w-px bg-rose-border" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              className="flex-1 border-none bg-transparent text-[15px] font-semibold text-rose-text outline-none"
            />
          </div>
        </label>

        <label className="text-[13px] font-bold text-rose-fieldLabel">
          City
          <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5 h-[52px]" placeholder="Coimbatore" />
        </label>

        {role === 'seller' && (
          <label className="text-[13px] font-bold text-rose-fieldLabel">
            Boutique name
            <Input value={boutiqueName} onChange={(e) => setBoutiqueName(e.target.value)} className="mt-1.5 h-[52px]" placeholder="Elegance Boutique" />
          </label>
        )}

        <Button full onClick={handleSignUp} disabled={sending} className="mt-1.5">
          {sending ? 'Sending code…' : 'Create Account'}
        </Button>

        <div className="text-center text-sm text-rose-muted">
          Have an account?{' '}
          <a onClick={() => navigate(`/auth/signin/${role}`)} className="cursor-pointer font-bold">
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
