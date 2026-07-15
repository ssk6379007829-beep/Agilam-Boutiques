import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Input } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

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
    <div className="flex h-screen items-stretch justify-center bg-[#FDF6F9] p-8">
      <div className="flex w-full max-w-[960px] overflow-hidden rounded-3xl bg-white shadow-panel">
        <div
          className="flex flex-1 flex-col justify-between p-14 text-white"
          style={{ background: 'linear-gradient(160deg,#D6336C,#8E1C44)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 font-serif text-2xl font-bold">A</div>
            <div className="font-serif text-2xl font-bold">Agilam Admin</div>
          </div>
          <div>
            <div className="font-serif text-[46px] font-bold leading-[1.05]">
              Run the marketplace
              <br />
              with confidence.
            </div>
            <div className="mt-4 max-w-[380px] text-base opacity-85">
              Approvals, subscriptions, commissions, featured listings and analytics — all in one console.
            </div>
          </div>
          <div className="text-[13px] opacity-70">Coimbatore · Tamil Nadu</div>
        </div>
        <div className="flex w-[440px] flex-none flex-col justify-center p-14">
          <div className="font-serif text-[34px] font-bold">Admin sign in</div>
          <div className="mt-1.5 text-rose-muted">Restricted access</div>
          <div className="mt-7 flex flex-col gap-4">
            <label className="text-[13px] font-bold text-rose-fieldLabel">
              Email
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-[52px] bg-[#FDF6F9]"
                placeholder="admin@agilam.in"
              />
            </label>
            <label className="text-[13px] font-bold text-rose-fieldLabel">
              Password
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-[52px] bg-[#FDF6F9]"
              />
            </label>
            <Button full className="mt-1.5 h-[54px] rounded-2xl" onClick={handleSignIn} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
