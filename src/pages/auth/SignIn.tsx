import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Role } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/RequireRole';
import { css } from '@/lib/css';
import { AuthModal, PasswordField } from '@/components/auth/AuthModal';
import { useToast } from '@/components/ui/Toast';

export function SignIn() {
  const { role: roleParam } = useParams<{ role: string }>();
  const role = (roleParam === 'seller' ? 'seller' : 'buyer') as Role;
  const navigate = useNavigate();
  const { signInWithPassword } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);

  const roleWord = role === 'seller' ? 'boutique owner' : 'buyer';
  const roleIcon = role === 'seller' ? 'storefront' : 'shopping_bag';

  async function handleSignIn() {
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return toast('Enter a valid email address');
    if (!password) return toast('Enter your password');

    setSending(true);
    try {
      // Sign in as the role this page is for (only sellers/admins authenticate;
      // buyers browse without an account), so a boutique owner reliably lands on
      // the seller console instead of the buyer app.
      const profileRole = await signInWithPassword(trimmedEmail, password, role);
      navigate(homeFor(profileRole), { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthModal
      icon={roleIcon}
      heading="Welcome back"
      sub={`Sign in to continue to your ${roleWord} workspace.`}
      onBack={() => navigate('/buyer/home')}
    >
      <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
        Email or phone
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hello@agilam.in"
          style={css('width:100%;margin-top:7px;border:1.5px solid #F0D8E2;background:#fff;border-radius:14px;padding:0 15px;height:52px;font-size:15px;font-weight:600;color:#2A1A20;')}
        />
      </label>

      <PasswordField value={password} onChange={setPassword} />

      <div style={css('display:flex;align-items:center;justify-content:space-between;font-size:13px;')}>
        <label style={css('display:flex;align-items:center;gap:7px;color:#7A5C67;font-weight:600;cursor:pointer;')}>
          <input type="checkbox" defaultChecked style={css('width:16px;height:16px;accent-color:#D6336C;')} />Remember me
        </label>
        <a href="#" onClick={(e) => { e.preventDefault(); toast('Password reset coming soon'); }} style={css('font-weight:700;')}>Forgot password?</a>
      </div>

      <button
        onClick={handleSignIn}
        disabled={sending}
        style={css('width:100%;height:54px;border:none;border-radius:16px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);display:flex;align-items:center;justify-content:center;gap:8px;')}
      >
        {sending ? 'Signing in…' : 'Login'}
        <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>arrow_forward</span>
      </button>

      <div style={css('display:flex;align-items:center;gap:12px;color:#B79AA6;font-size:13px;')}>
        <div style={css('flex:1;height:1px;background:#F0D8E2;')} />or continue with<div style={css('flex:1;height:1px;background:#F0D8E2;')} />
      </div>
      <div style={css('display:flex;gap:12px;')}>
        <button onClick={() => toast('Google sign-in coming soon')} style={css('flex:1;height:50px;border:1.5px solid #F0D8E2;background:#fff;border-radius:14px;font-weight:700;cursor:pointer;color:#2A1A20;')}>Google</button>
        <button onClick={() => toast('Apple sign-in coming soon')} style={css('flex:1;height:50px;border:1.5px solid #F0D8E2;background:#fff;border-radius:14px;font-weight:700;cursor:pointer;color:#2A1A20;')}>Apple</button>
      </div>

      <div style={css('text-align:center;font-size:14px;color:#8A7078;')}>
        New to Agilam? <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/auth/signup/${role}`); }} style={css('font-weight:700;')}>Create an account</a>
      </div>
    </AuthModal>
  );
}
