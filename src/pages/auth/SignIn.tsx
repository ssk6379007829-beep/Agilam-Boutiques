import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Role } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';

export function SignIn() {
  const { role: roleParam } = useParams<{ role: string }>();
  const role = (roleParam === 'seller' ? 'seller' : 'buyer') as Role;
  const navigate = useNavigate();
  const { sendEmailOtp } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const roleWord = role === 'seller' ? 'boutique owner' : 'buyer';

  async function handleSignIn() {
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast('Enter a valid email address');
      return;
    }
    setSending(true);
    try {
      await sendEmailOtp(trimmedEmail);
      navigate('/auth/otp', { state: { email: trimmedEmail, role, mode: 'signin' } });
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
          Email address
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-[52px]"
            placeholder="priya@example.com"
          />
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
