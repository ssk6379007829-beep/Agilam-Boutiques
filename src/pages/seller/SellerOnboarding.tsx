import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useAuth } from '@/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { useToast } from '@/components/ui/Toast';
import { fetchMyBoutique, createMyBoutique } from '@/data/boutiques';

const fieldStyle = 'width:100%;margin-top:7px;border:1.5px solid #F0D8E2;background:#fff;border-radius:14px;padding:0 15px;height:52px;font-size:15px;font-weight:600;color:#2A1A20;box-sizing:border-box;';
const labelStyle = 'font-size:13px;font-weight:700;color:#7A5C67;';

/**
 * Boutique onboarding — shown to a seller who has an account (e.g. just signed
 * in with Google) but no boutique yet. Sellers who already have one are sent
 * straight to their console; email sign-up creates the boutique inline, so this
 * is only reached via the Google seller path.
 */
export function SellerOnboarding() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate('/auth/signin/seller', { replace: true });
      return;
    }
    // Already have a boutique? Skip straight to the console.
    fetchMyBoutique(session.user.id)
      .then((b) => { if (b) navigate('/seller/dashboard', { replace: true }); })
      .catch(() => { /* let them create one */ });
  }, [session, loading, navigate]);

  const create = async () => {
    if (name.trim().length < 2) return toast('Enter your boutique name');
    if (!session) return;
    setBusy(true);
    try {
      await createMyBoutique(session.user.id, { name: name.trim(), city: city.trim() });
      toast('Boutique created');
      navigate('/seller/dashboard', { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create your boutique');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthModal icon="add_business" heading="Set up your boutique" sub="Tell us about your boutique to start selling on Agilam.">
      <label style={css(labelStyle)}>
        Boutique name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Elegance Boutique" autoFocus style={css(fieldStyle)} />
      </label>
      <label style={css(labelStyle)}>
        City
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Coimbatore" style={css(fieldStyle)} />
      </label>

      <button
        onClick={create}
        disabled={busy}
        style={css(`width:100%;height:54px;border:none;border-radius:16px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);display:flex;align-items:center;justify-content:center;gap:8px;opacity:${busy ? 0.7 : 1};`)}
      >
        {busy ? 'Creating…' : 'Create boutique'}
        <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>arrow_forward</span>
      </button>
    </AuthModal>
  );
}
