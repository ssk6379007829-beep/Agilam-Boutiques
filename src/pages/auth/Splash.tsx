import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/RequireRole';
import { FullscreenLoader } from '@/auth/RequireRole';

export function Splash() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();

  if (loading) return <FullscreenLoader />;
  if (session && profile) return <Navigate to={homeFor(profile.role)} replace />;

  return (
    <div
      className="mx-auto flex h-[100dvh] max-w-[520px] flex-col px-8 pb-9 pt-10 text-white"
      style={{ background: 'linear-gradient(170deg,#D6336C 0%,#B02454 55%,#8E1C44 100%)' }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div
          className="flex h-[88px] w-[88px] items-center justify-center rounded-[26px] font-serif text-5xl font-bold"
          style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(6px)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)' }}
        >
          A
        </div>
        <div className="mt-5 font-serif text-[44px] font-bold leading-none">Agilam Boutiques</div>
        <div className="mt-2 font-script text-2xl opacity-95">All Boutiques. One Place.</div>
        <div className="mt-6 text-sm uppercase tracking-[.14em] opacity-80">Discover · Connect · Chat · Shop</div>
      </div>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate('/auth/signin/buyer')}
          className="h-[54px] w-full rounded-2xl border-none bg-white text-base font-extrabold text-rose-primaryDark shadow-[0_12px_30px_-12px_rgba(0,0,0,.4)]"
        >
          Continue as Buyer
        </button>
        <button
          onClick={() => navigate('/auth/signin/seller')}
          className="h-[54px] w-full rounded-2xl border-[1.5px] border-white/60 bg-white/10 text-base font-bold text-white"
        >
          I'm a Boutique Owner
        </button>
        <button onClick={() => navigate('/admin/login')} className="mt-1 text-center text-xs font-semibold text-white/70">
          Platform admin sign in
        </button>
      </div>
    </div>
  );
}
