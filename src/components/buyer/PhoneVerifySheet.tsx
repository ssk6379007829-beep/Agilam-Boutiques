import { useRef, useState } from 'react';
import { css } from '@/lib/css';
import { phoneOk } from '@/lib/buyerDetails';
import { sendPhoneOtp, verifyPhoneOtp } from '@/lib/guestSync';

/**
 * Phone verification sheet — send an SMS OTP, then confirm the 6-digit code.
 * On success the browser holds a phone-verified Supabase session, which lets the
 * profile sync across devices. Needs an SMS provider enabled in Supabase; until
 * then `sendPhoneOtp` surfaces a friendly message.
 */
export function PhoneVerifySheet({
  initialPhone = '',
  onVerified,
  onClose,
}: {
  initialPhone?: string;
  onVerified: (phone: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const phoneValid = phoneOk(phone);
  const code = digits.join('');
  const codeFilled = code.length === 6;

  const send = async () => {
    if (!phoneValid) return setError('Enter a valid 10-digit mobile number.');
    setBusy(true);
    setError('');
    try {
      await sendPhoneOtp(phone);
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!codeFilled) return setError('Enter all 6 digits.');
    setBusy(true);
    setError('');
    try {
      await verifyPhoneOtp(phone, code);
      onVerified(phone.replace(/\D/g, '').slice(-10));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setDigits((prev) => prev.map((x, j) => (j === i ? d : x)));
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };
  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  return (
    <div
      onClick={onClose}
      style={css('position:fixed;inset:0;z-index:230;background:rgba(40,10,22,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;')}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={css('width:100%;max-width:440px;margin:auto;background:#fff;border-radius:28px;padding:24px 24px 26px;box-shadow:0 30px 80px -30px rgba(107,20,54,.6);')}
      >
        <div style={css('width:56px;height:56px;border-radius:17px;background:linear-gradient(135deg,#D6336C,#B02454);display:flex;align-items:center;justify-content:center;margin:0 auto;box-shadow:0 16px 34px -16px rgba(214,51,108,.8);')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:28px;")}>{step === 'phone' ? 'sms' : 'verified'}</span>
        </div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;text-align:center;margin-top:15px;line-height:1.15;")}>
          {step === 'phone' ? 'Verify your number' : 'Enter the code'}
        </div>
        <div style={css('text-align:center;color:#8A7078;font-size:13.5px;margin-top:8px;line-height:1.5;max-width:330px;margin-left:auto;margin-right:auto;')}>
          {step === 'phone'
            ? 'We’ll text a 6-digit code to keep your orders & details synced across devices.'
            : `6-digit code sent to +91 ${phone}`}
        </div>

        {step === 'phone' ? (
          <div style={css('margin-top:22px;')}>
            <label style={css('font-size:12.5px;font-weight:800;color:#7A5C67;')}>
              Mobile number
              <div style={css('display:flex;align-items:center;margin-top:7px;border:1.5px solid #F0D8E2;background:#FBF6F2;border-radius:14px;padding:0 15px;height:52px;')}>
                <span style={css('font-weight:800;color:#8A7078;font-size:15px;')}>+91</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  inputMode="numeric"
                  placeholder="10-digit number"
                  autoFocus
                  style={css('border:none;background:none;flex:1;margin-left:10px;font-size:15px;font-weight:600;color:#241019;min-width:0;')}
                />
              </div>
            </label>
          </div>
        ) : (
          <div style={css('display:flex;gap:10px;justify-content:center;margin-top:22px;')}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                maxLength={1}
                inputMode="numeric"
                autoFocus={i === 0}
                style={css(`width:46px;height:56px;text-align:center;font-size:23px;font-weight:800;border:1.5px solid ${d ? '#D6336C' : '#F0D8E2'};background:#FBF6F2;border-radius:14px;color:#2A1A20;`)}
              />
            ))}
          </div>
        )}

        {error && <div style={css('color:#C0455E;font-size:12.5px;font-weight:700;margin-top:12px;text-align:center;')}>{error}</div>}

        <div style={css('display:flex;flex-direction:column;gap:10px;margin-top:22px;')}>
          <button
            onClick={step === 'phone' ? send : verify}
            disabled={busy}
            style={css(`height:54px;border:none;border-radius:16px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.8);display:flex;align-items:center;justify-content:center;gap:8px;opacity:${busy ? 0.7 : 1};`)}
          >
            {busy ? 'Please wait…' : step === 'phone' ? 'Send code' : 'Verify & sync'}
            {!busy && <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>arrow_forward</span>}
          </button>
          {step === 'code' ? (
            <button onClick={() => { setStep('phone'); setDigits(['', '', '', '', '', '']); setError(''); }} style={css('height:44px;border:none;background:none;color:#8A7078;font-weight:700;font-size:14px;cursor:pointer;')}>
              Change number
            </button>
          ) : (
            <button onClick={onClose} style={css('height:44px;border:none;background:none;color:#8A7078;font-weight:700;font-size:14px;cursor:pointer;')}>
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
