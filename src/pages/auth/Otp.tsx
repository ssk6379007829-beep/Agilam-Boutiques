import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { useToast } from '@/components/ui/Toast';

/**
 * "Verify your number" artboard from the design.
 *
 * The app authenticates with Supabase email/password — there is no phone/OTP
 * backend — so this screen is presentational: it cannot create a session, and
 * the real sign-in paths do not route through it. Wire it to Supabase phone
 * auth before putting it in a live flow.
 */
export function Otp() {
  const navigate = useNavigate();
  const { role = 'buyer' } = useParams();
  const toast = useToast();
  const [digits, setDigits] = useState(['4', '9', '', '', '', '']);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setDigits((prev) => prev.map((x, j) => (j === i ? d : x)));
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const filled = digits.every(Boolean);

  return (
    <div style={css('min-height:100vh;padding:18px 20px 44px;display:flex;flex-direction:column;align-items:center;background:#FBF6F2;')}>
      <div style={css('width:100%;max-width:440px;display:flex;flex-direction:column;flex:1;')}>
        <button onClick={() => navigate(`/auth/signin/${role}`)} style={css('border:none;background:#fff;width:42px;height:42px;border-radius:12px;box-shadow:0 6px 18px -10px rgba(107,20,54,.5);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>

        <div style={css('flex:1;display:flex;flex-direction:column;justify-content:center;')}>
          <div style={css('width:64px;height:64px;border-radius:20px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:32px;color:#D6336C;")}>sms</span>
          </div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:34px;margin-top:20px;")}>Verify your number</div>
          <div style={css('color:#8A7078;font-size:15px;margin-top:6px;')}>
            Enter the 6-digit code sent to <b style={css('color:#2A1A20;')}>+91 98765 43210</b>
          </div>

          <div style={css('display:flex;gap:10px;margin-top:28px;')}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                maxLength={1}
                inputMode="numeric"
                style={css(`width:48px;height:58px;text-align:center;font-size:24px;font-weight:800;border:1.5px solid ${d ? '#D6336C' : '#F0D8E2'};background:#fff;border-radius:14px;color:#2A1A20;`)}
              />
            ))}
          </div>

          <button
            onClick={() => toast(filled ? 'Phone verification is not wired up yet' : 'Enter all 6 digits')}
            style={css('width:100%;height:54px;margin-top:28px;border:none;border-radius:16px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 14px 30px -14px rgba(214,51,108,.8);')}
          >
            Verify &amp; Continue
          </button>

          <div style={css('text-align:center;font-size:14px;color:#8A7078;margin-top:16px;')}>
            Didn&apos;t get the code? <a href="#" onClick={(e) => { e.preventDefault(); toast('Code resent'); }} style={css('font-weight:700;')}>Resend</a>
          </div>
        </div>
      </div>
    </div>
  );
}
