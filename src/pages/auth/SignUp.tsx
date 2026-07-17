import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Role } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/RequireRole';
import { css } from '@/lib/css';
import { AuthPanel, PasswordField, type LoginRole } from '@/components/auth/AuthPanel';
import { MobileAuthCard } from '@/components/auth/MobileAuthCard';
import { useToast } from '@/components/ui/Toast';

const fieldStyle = 'width:100%;margin-top:7px;border:1.5px solid #F0D8E2;background:#fff;border-radius:14px;padding:0 15px;height:52px;font-size:15px;font-weight:600;color:#2A1A20;';
const labelStyle = 'font-size:13px;font-weight:700;color:#7A5C67;';

export function SignUp() {
  const { role: roleParam } = useParams<{ role: string }>();
  const role = (roleParam === 'seller' ? 'seller' : 'buyer') as Role;
  const navigate = useNavigate();
  const { signUpWithPassword } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [boutiqueName, setBoutiqueName] = useState('');
  const [sending, setSending] = useState(false);

  const roleWord = role === 'seller' ? 'boutique owner' : 'buyer';

  const onRoleChange = (r: LoginRole) => {
    if (r === 'buyer') navigate('/buyer/home');
    else if (r === 'admin') navigate('/admin/login');
    else navigate('/auth/signup/seller');
  };

  async function handleSignUp() {
    const trimmedEmail = email.trim();
    if (!fullName.trim()) return toast('Enter your full name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return toast('Enter a valid email address');
    if (password.length < 6) return toast('Password must be at least 6 characters');
    if (role === 'seller' && !boutiqueName.trim()) return toast('Enter your boutique name');

    setSending(true);
    try {
      const { confirmationRequired } = await signUpWithPassword(trimmedEmail, password, {
        full_name: fullName,
        role,
        city,
        boutiqueName,
      });
      if (confirmationRequired) {
        toast('Check your email to confirm your account, then sign in');
        navigate(`/auth/signin/${role}`);
      } else {
        navigate(homeFor(role), { replace: true });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create account');
    } finally {
      setSending(false);
    }
  }

  // Shared between the mobile card and the desktop split-panel.
  const fields = (
    <>
      <label style={css(labelStyle)}>
        Full name
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Priya Sharma" style={css(fieldStyle)} />
      </label>

      <label style={css(labelStyle)}>
        Email address
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" style={css(fieldStyle)} />
      </label>

      <PasswordField value={password} onChange={setPassword} />

      <label style={css(labelStyle)}>
        City
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Coimbatore" style={css(fieldStyle)} />
      </label>

      {role === 'seller' && (
        <label style={css(labelStyle)}>
          Boutique name
          <input value={boutiqueName} onChange={(e) => setBoutiqueName(e.target.value)} placeholder="Elegance Boutique" style={css(fieldStyle)} />
        </label>
      )}

      <button
        onClick={handleSignUp}
        disabled={sending}
        style={css('width:100%;height:54px;border:none;border-radius:16px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);display:flex;align-items:center;justify-content:center;gap:8px;')}
      >
        {sending ? 'Creating account…' : 'Create Account'}
        <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>arrow_forward</span>
      </button>

      <div style={css('text-align:center;font-size:14px;color:#8A7078;')}>
        Have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/auth/signin/${role}`); }} style={css('font-weight:700;')}>Sign in</a>
      </div>
    </>
  );

  return (
    <>
      <div className="agx-auth-mobile">
        <MobileAuthCard heading="Create account" sub={`Join as a ${roleWord}`} onBack={() => navigate(`/auth/signin/${role}`)}>
          {fields}
        </MobileAuthCard>
      </div>

      <div className="agx-auth-desktop">
        <AuthPanel role={role as LoginRole} onRoleChange={onRoleChange} heading="Create account">
          <div style={css('margin-top:22px;display:flex;flex-direction:column;gap:15px;')}>{fields}</div>
        </AuthPanel>
      </div>
    </>
  );
}
