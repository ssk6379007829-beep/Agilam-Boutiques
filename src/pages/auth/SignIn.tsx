import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Role } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function SignIn() {
  const { role: roleParam } = useParams<{ role: string }>();
  const role = (roleParam === 'seller' ? 'seller' : 'buyer') as Role;
  const navigate = useNavigate();
  const { sendPhoneOtp } = useAuth();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const roleWord = role === 'seller' ? 'boutique owner' : 'buyer';

  async function handleSignIn() {
    const fullPhone = '+91' + phone.replace(/\D/g, '');
    if (phone.replace(/\D/g, '').length < 10) {
      toast('Enter a valid 10-digit phone number');
      return;
    }
    setSending(true);
    try {
      await sendPhoneOtp(fullPhone);
      navigate('/auth/otp', { state: { phone: fullPhone, role, mode: 'signin' } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[520px] flex-col bg-rose-card px-6 py-4 pb-9">
      <IconButton icon="arrow_back" onClick={() => navigate('/')} />
      <div className="mt-6 font-serif text-[36px] font-bold leading-[1.05]">Welcome back</div>
      <div className="mt-1.5 text-[15px] text-rose-muted">Sign in to your {roleWord} account</div>

      <div className="mt-6 flex flex-col gap-4">
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

        <Button full onClick={handleSignIn} disabled={sending}>
          {sending ? 'Sending code…' : 'Send OTP'}
        </Button>

        <div className="mt-1 text-center text-sm text-rose-muted">
          New here?{' '}
          <a onClick={() => navigate(`/auth/signup/${role}`)} className="cursor-pointer font-bold">
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}
