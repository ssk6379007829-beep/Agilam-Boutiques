import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { css } from '@/lib/css';
import { useToast } from '@/components/ui/Toast';

const fieldStyle = 'width:100%;margin-top:7px;border:1.5px solid #F0D8E2;background:#FBF6F2;border-radius:12px;padding:0 14px;height:52px;font-size:15px;font-weight:600;';

export function AdminLogin() {
  const { adminSignIn } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    try {
      await adminSignIn(email, password);
      navigate('/admin/overview', { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={css('min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FBF6F2;padding:32px;')}>
      <div style={css('width:100%;max-width:960px;height:720px;background:#fff;border-radius:24px;box-shadow:0 30px 80px -40px rgba(107,20,54,.5);overflow:hidden;display:flex;')}>
        <div className="agx-hide-sm" style={css('flex:1;background:linear-gradient(160deg,#D6336C,#8E1C44);color:#fff;padding:56px;display:flex;flex-direction:column;justify-content:space-between;')}>
          <div style={css('display:flex;align-items:center;gap:12px;')}>
            <div style={css("width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>A</div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>Agilam Admin</div>
          </div>
          <div>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:46px;line-height:1.05;")}>
              Run the marketplace<br />with confidence.
            </div>
            <div style={css('font-size:16px;opacity:.85;margin-top:16px;max-width:380px;')}>
              Approvals, subscriptions, commissions, featured listings and analytics — all in one console.
            </div>
          </div>
          <div style={css('font-size:13px;opacity:.7;')}>Coimbatore · Tamil Nadu</div>
        </div>

        <div style={css('width:440px;flex:none;padding:56px 48px;display:flex;flex-direction:column;justify-content:center;')}>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:34px;")}>Admin sign in</div>
          <div style={css('color:#8A7078;margin-top:6px;')}>Restricted access</div>
          <div style={css('margin-top:28px;display:flex;flex-direction:column;gap:16px;')}>
            <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@agilam.in" style={css(fieldStyle)} />
            </label>
            <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={css(fieldStyle)} />
            </label>
            <button onClick={handleSignIn} disabled={busy} style={css('width:100%;height:54px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:pointer;margin-top:6px;')}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
