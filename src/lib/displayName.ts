import type { Session } from '@supabase/supabase-js';

/** Names auto-seeded by sign-up — never show these as the user's real name. */
const PLACEHOLDER_NAMES = ['New user', 'Customer', 'Guest'];

/** "Selva Kumar" -> "SK", "Priya" -> "PR". Empty when there's no name yet. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "selva.kumar" / "selva_kumar" -> "Selva Kumar" for an email-derived name. */
export function prettifyName(local: string): string {
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/**
 * The name to show for the signed-in account, most-trusted source first:
 * the saved profile name, then the Google/OAuth metadata name, then any
 * locally-saved guest name, then a name derived from the account email — so a
 * signed-in user always sees themselves instead of a hardcoded placeholder.
 */
export function resolveDisplayName(
  profile: { full_name?: string | null } | null | undefined,
  session: Session | null | undefined,
  guestName = '',
): string {
  const meta = session?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const email = session?.user?.email ?? '';
  const saved = profile?.full_name && !PLACEHOLDER_NAMES.includes(profile.full_name) ? profile.full_name : '';
  return saved || meta?.full_name || meta?.name || guestName || (email ? prettifyName(email.split('@')[0]) : '') || '';
}
