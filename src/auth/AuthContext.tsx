import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
  signUpWithPassword: (email: string, password: string, pending: PendingSignup) => Promise<{ confirmationRequired: boolean; role: Role }>;
  signInWithPassword: (email: string, password: string, desiredRole?: Role) => Promise<Role>;
  adminSignIn: (email: string, password: string) => Promise<Role>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Persist the role a user signed in as, keyed by user id, so a full page reload
// of a guarded route keeps routing them to the right console even if the DB
// profile row hasn't caught up (e.g. RLS blocking a role update).
const ROLE_KEY = 'agx-desired-role';
function readStoredRole(userId: string): Role | null {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; role?: Role };
    return parsed.id === userId && parsed.role ? parsed.role : null;
  } catch {
    return null;
  }
}
function writeStoredRole(userId: string, role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, JSON.stringify({ id: userId, role }));
  } catch {
    /* storage unavailable — the in-memory ref still covers this session */
  }
}
function clearStoredRole() {
  try {
    localStorage.removeItem(ROLE_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Role the user explicitly signed in as. Kept so the onAuthStateChange
  // listener's profile reload (which reads DB truth) can't clobber it back to
  // buyer within the session. Cleared on sign-out.
  const desiredRoleRef = useRef<Role | null>(null);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    let prof = data ? (data as Profile) : null;
    const override = desiredRoleRef.current ?? readStoredRole(userId);
    if (prof && override) prof = { ...prof, role: override };
    setProfile(prof);
  }

  /**
   * Populate session + profile synchronously after an auth call and resolve the
   * account's role. Callers await this before navigating so the role-guarded
   * routes see a loaded profile instead of racing the onAuthStateChange
   * listener (which otherwise bounces a fresh seller to the buyer app).
   */
  async function hydrate(user: User, newSession: Session | null, desiredRole?: Role): Promise<Role> {
    if (desiredRole) {
      desiredRoleRef.current = desiredRole;
      writeStoredRole(user.id, desiredRole);
    }
    await ensureProfile(user, desiredRole);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    let prof = data ? (data as Profile) : null;
    // The sign-in page carries an explicit role intent (only sellers/admins ever
    // authenticate — buyers browse without an account). Honour it locally so the
    // role-guarded route renders even if the profile row hasn't caught up yet.
    if (desiredRole) {
      prof = prof
        ? { ...prof, role: desiredRole }
        : { id: user.id, role: desiredRole, full_name: user.email ?? 'New user', phone: null, email: user.email ?? null, city: null };
    }
    setSession(newSession);
    setProfile(prof);
    return prof?.role ?? desiredRole ?? 'buyer';
  }

  async function ensureProfile(user: User, desiredRole?: Role) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) {
      // Align an existing profile with the role the user is signing in as.
      if (desiredRole && (existing as { role: Role }).role !== desiredRole) {
        await supabase.from('profiles').update({ role: desiredRole }).eq('id', user.id);
      }
      return;
    }

    const meta = (user.user_metadata ?? {}) as Partial<PendingSignup>;
    const role: Role = desiredRole ?? meta.role ?? 'buyer';
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
    // When email confirmation is off, Supabase returns a session immediately —
    // hydrate so the guarded route sees the new profile before we navigate.
    const role = data.session && data.user ? await hydrate(data.user, data.session) : pending.role;
    return { confirmationRequired: !data.session, role };
  }

  async function signInWithPassword(email: string, password: string, desiredRole?: Role): Promise<Role> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user ? hydrate(data.user, data.session, desiredRole) : (desiredRole ?? 'buyer');
  }

  async function adminSignIn(email: string, password: string): Promise<Role> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user ? hydrate(data.user, data.session) : 'buyer';
  }

  async function signOut() {
    desiredRoleRef.current = null;
    clearStoredRole();
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
