import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/types/database';

type Profile = {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
};

export type PendingSignup = {
  full_name: string;
  role: Role;
  city?: string;
  boutiqueName?: string;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string, pending?: PendingSignup) => Promise<void>;
  adminSignIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ? (data as Profile) : null);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session) await loadProfile(data.session.user.id);
      })
      .catch((e) => console.error('Failed to load Supabase session', e))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) await loadProfile(newSession.user.id);
      else setProfile(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function sendEmailOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  }

  async function verifyEmailOtp(email: string, token: string, pending?: PendingSignup) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    const user = data.user;
    if (!user) return;

    const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();

    if (!existing) {
      const role: Role = pending?.role ?? 'buyer';
      await supabase.from('profiles').insert({
        id: user.id,
        role,
        full_name: pending?.full_name ?? 'New user',
        email,
        city: pending?.city ?? null,
      });

      if (role === 'seller' && pending?.boutiqueName) {
        await supabase.from('boutiques').insert({
          owner_id: user.id,
          name: pending.boutiqueName,
          city: pending.city ?? '',
          tone: Math.floor(Math.random() * 8),
        });
      }
    }

    await loadProfile(user.id);
  }

  async function adminSignIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, sendEmailOtp, verifyEmailOtp, adminSignIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
