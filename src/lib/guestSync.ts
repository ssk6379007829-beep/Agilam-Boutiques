import { supabase } from '@/lib/supabase';
import { fromDbOrder, mergeServerOrders, type DbOrder } from '@/lib/orderHistory';

/**
 * Phone-verified cross-device sync for anonymous buyers.
 *
 * Buyers have no account, but they can verify their phone with Supabase phone
 * OTP. That gives a session whose phone the server trusts, so /api/guest-sync
 * can persist their profile and hand back their real orders by phone. Requires
 * an SMS provider enabled in the Supabase dashboard (Auth → Providers → Phone);
 * until then `sendPhoneOtp` surfaces a clear message rather than failing opaquely.
 */

type GuestProfile = { name: string | null; city: string | null; address: string | null };

const toE164 = (phone: string) => '+91' + phone.replace(/\D/g, '').slice(-10);

/** Turn Supabase's raw auth errors into something a shopper can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('provider') || m.includes('disabled') || m.includes('not enabled') || m.includes('unsupported')) {
    return 'Phone verification isn’t set up yet. Please try again later.';
  }
  if (m.includes('invalid') || m.includes('expired') || m.includes('token')) {
    return 'That code is incorrect or expired. Please try again.';
  }
  if (m.includes('rate') || m.includes('too many')) return 'Too many attempts — wait a minute and retry.';
  return message;
}

/** Send a 6-digit SMS code to the given 10-digit number. */
export async function sendPhoneOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
  if (error) throw new Error(friendly(error.message));
}

/** Verify the code; on success the browser holds a phone-verified session. */
export async function verifyPhoneOtp(phone: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code.trim(), type: 'sms' });
  if (error) throw new Error(friendly(error.message));
}

/** True once this browser holds a session with a verified phone. */
export async function hasVerifiedPhone(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session?.user?.phone;
}

/**
 * Push the given profile fields (if any) to the DB and pull back the saved
 * profile + the buyer's real orders (merged into local history). Requires a
 * verified-phone session.
 */
export async function syncGuest(patch?: { name?: string; city?: string; address?: string }): Promise<GuestProfile | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Verify your phone first');

  const res = await fetch('/api/guest-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch ?? {}),
  });
  const body = (await res.json().catch(() => ({}))) as { profile?: GuestProfile; orders?: DbOrder[]; error?: string };
  if (!res.ok) throw new Error(body.error || 'Could not sync your details.');

  mergeServerOrders((body.orders ?? []).map(fromDbOrder));
  return body.profile ?? null;
}
