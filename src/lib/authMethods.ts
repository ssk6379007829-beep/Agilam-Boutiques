import { supabase } from '@/lib/supabase';

/**
 * Passwordless / social auth helpers for buyers.
 *
 * Buyers can sign in with Google or an emailed one-time code (no SMS provider
 * needed — Supabase sends these over email out of the box). Once signed in they
 * have a real account, so their profile syncs via the `profiles` table and their
 * orders via the `buyer_id` RLS policy. Email+password stays available through
 * AuthContext's existing sign-in/up.
 *
 * Config: Google needs the Google provider enabled in the Supabase dashboard
 * (Auth → Providers → Google) with this app's URL added to the allowed redirect
 * URLs. Email OTP works with the default email provider.
 */

/** Human-friendly text for the raw Supabase auth errors. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'That sign-in method isn’t set up yet. Try email instead.';
  }
  if (m.includes('invalid') && m.includes('token')) return 'That code is incorrect or expired. Please try again.';
  if (m.includes('otp') && m.includes('expired')) return 'That code has expired — request a new one.';
  if (m.includes('email not confirmed')) return 'Please confirm your email, then try again.';
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many attempts — wait a minute and retry.';
  return message;
}

/** Kick off Google OAuth. Redirects the page to Google and back to the profile. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/buyer/profile` },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** Email a 6-digit login code (creating the account if it's new). */
export async function sendEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** Verify the emailed code; on success the browser holds a session. */
export async function verifyEmailOtp(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw new Error(friendlyAuthError(error.message));
}
