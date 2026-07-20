import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useShop } from '@/state/ShopContext';
import { AccountSheet } from '@/components/buyer/AccountSheet';

/** How long a buyer browses before we invite them to sign in (ms). */
const PROMPT_AFTER_MS = 45_000;
/** Session flag so the invite shows at most once per browser session. */
const SEEN_KEY = 'agx.loginPrompt.seen';

/**
 * Gentle, one-time nudge for anonymous buyers to create an account / sign in.
 *
 * Buyers shop anonymously (see ShopContext), so we don't gate anything — after
 * they've been around for a little while we surface the same AccountSheet used
 * on the profile screen, framed as an invitation to keep their cart & orders on
 * every device. It appears at most once per session and never for a signed-in
 * user, so it nudges without nagging.
 */
export function LoginPrompt() {
  const { session, loading } = useAuth();
  const { showToast } = useShop();
  const [open, setOpen] = useState(false);

  const signedIn = !!session;

  useEffect(() => {
    // Never prompt a signed-in user, while auth is still resolving, or if this
    // session has already been shown (or dismissed) the invite.
    if (loading || signedIn) return;
    if (sessionStorage.getItem(SEEN_KEY)) return;

    const t = setTimeout(() => {
      // Re-check at fire time — the buyer may have signed in during the wait.
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, '1');
      setOpen(true);
    }, PROMPT_AFTER_MS);

    return () => clearTimeout(t);
  }, [loading, signedIn]);

  if (!open) return null;

  return (
    <AccountSheet
      title="Save your bag & orders"
      subtitle="Sign in to keep your cart, wishlist and orders on any device — it only takes a moment."
      onDone={() => {
        setOpen(false);
        showToast('Signed in');
      }}
      onClose={() => setOpen(false)}
    />
  );
}
