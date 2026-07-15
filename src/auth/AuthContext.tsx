import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
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
  signUpWithPassword: (email: string, password: string, pending: PendingSignup) => Promise<{ confirmationRequired: boolean }>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
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

  async function ensureProfile(user: User) {
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (existing) return;

    const meta = (user.user_metadata ?? {}) as Partial<PendingSignup>;
    const role: Role = meta.role ?? 'buyer';
    await supabase.from('profiles').insert({
      id: user.id,
      role,
      full_name: meta.full_name ?? 'New user',
      email: user.email,
      city: meta.city ?? null,
    });

    if (role === 'seller' && meta.boutiqueName) {
      await supabase.from('boutiques').insert({
        owner_id: user.id,
        name: meta.boutiqueName,
        city: meta.city ?? '',
        tone: Math.floor(Math.random() * 8),
      });
    }
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session) {
          await ensureProfile(data.session.user);
          await loadProfile(data.session.user.id);
        }
      })
      .catch((e) => console.error('Failed to load Supabase session', e))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await ensureProfile(newSession.user);
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signUpWithPassword(email: string, password: string, pending: PendingSignup) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: pending },
    });
    if (error) throw error;
    return { confirmationRequired: !data.session };
  }

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
    <AuthContext.Provider
      value={{ session, profile, loading, signUpWithPassword, signInWithPassword, adminSignIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
