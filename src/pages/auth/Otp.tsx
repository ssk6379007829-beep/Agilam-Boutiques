import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type PendingSignup } from '@/auth/AuthContext';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { homeFor } from '@/auth/RequireRole';

type OtpState = { phone: string; role: 'buyer' | 'seller'; mode: 'signin' | 'signup'; pending?: PendingSignup };

export function Otp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyPhoneOtp, sendPhoneOtp } = useAuth();
  const toast = useToast();
  const state = location.state as OtpState | null;

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  if (!state?.phone) {
    navigate('/', { replace: true });
    return null;
  }
  const otpState = state;

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, '').slice(0, 1);
    setDigits((d) => {
      const next = [...d];
      next[i] = clean;
      return next;
    });
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length !== 6) return toast('Enter the 6-digit code');
    setVerifying(true);
    try {
      await verifyPhoneOtp(otpState.phone, code, otpState.pending);
      toast('Signed in successfully');
      navigate(homeFor(otpState.role), { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[520px] flex-col bg-rose-card px-6 py-4 pb-9">
      <IconButton icon="arrow_back" onClick={() => navigate(-1)} />
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-rose-chip">
          <Icon name="sms" style={{ fontSize: 32, color: '#D6336C' }} />
        </div>
        <div className="mt-5 font-serif text-[34px] font-bold">Verify your number</div>
        <div className="mt-1.5 text-[15px] text-rose-muted">
          Enter the 6-digit code sent to <b className="text-rose-text">{otpState.phone}</b>
        </div>
        <div className="mt-7 flex gap-2.5">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              value={d}
              maxLength={1}
              onChange={(e) => setDigit(i, e.target.value)}
              className="h-[58px] w-12 rounded-2xl border-[1.5px] bg-white text-center text-2xl font-extrabold text-rose-text outline-none"
              style={{ borderColor: d ? '#D6336C' : '#F0D8E2' }}
            />
          ))}
        </div>
        <div className="mt-5 text-sm text-rose-muted">
          Didn't get it?{' '}
          <a onClick={() => sendPhoneOtp(otpState.phone).then(() => toast('Code resent'))} className="cursor-pointer font-bold">
            Resend code
          </a>
        </div>
      </div>
      <Button full onClick={handleVerify} disabled={verifying}>
        {verifying ? 'Verifying…' : 'Verify & Continue'}
      </Button>
    </div>
  );
}
