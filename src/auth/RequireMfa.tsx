import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { readMfaState } from '@/lib/mfa';
import { FullscreenLoader } from './RequireRole';

// Lazy, because `RequireRole` is a static import from App.tsx and therefore in
// the entry chunk. The gate is a QR code, a keypad and a backup-code form that
// a buyer will never see; pulling it into the bundle that has to paint the
// storefront would undo the code-splitting work this app has already paid for.
const MfaGate = lazy(() => import('@/components/auth/MfaGate').then((m) => ({ default: m.MfaGate })));

/**
 * Blocks the console until the session has passed a second factor.
 *
 * WHAT THIS IS AND IS NOT
 * It is not the lock. Migration 0100 redefined `is_admin()` and `is_staff()` to
 * require a verified session, and 0102 widened what counts as one — so every
 * console policy already refuses an unverified session at the database, with or
 * without this component, and with or without our JavaScript being loaded at
 * all. What this does is make that refusal legible: without it, an admin who has
 * not entered a code sees a console where every screen loads and every screen is
 * empty, which is indistinguishable from an outage.
 *
 * WHY IT ASKS `readMfaState()` RATHER THAN THE ASSURANCE LEVEL
 * Because since 0102 the AAL is only half the answer. An emailed code cannot
 * move the JWT — GoTrue has no email factor — so an email-verified session reads
 * `aal1` for its whole life while the database considers it fully verified.
 * Reading the AAL here directly would lock every email user out of a console
 * that was working perfectly. `readMfaState()` asks both sources.
 *
 * WHY THERE IS NO "REMEMBER THIS DEVICE"
 * Verification is a property of the session, not of the browser. A trusted
 * device would be an unverified session, so RLS would hand it the same empty
 * console — the trust would have to be honoured in React, over data the database
 * is refusing, which cannot work and should not.
 *
 * It costs less than it sounds. Supabase sessions persist in localStorage across
 * refreshes, tab closes and reboots, and both methods hold their verification
 * for the life of the session, so a code is typed on a real sign-in — not daily.
 */
export function RequireMfa({ children }: { children: ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    setVerified((await readMfaState()) === 'verified');
  }, []);

  useEffect(() => {
    void check();

    // MFA_CHALLENGE_VERIFIED fires when GoTrue swaps in the aal2 token, and
    // TOKEN_REFRESHED when it renews one. Both change the answer, and neither
    // re-renders this component on its own.
    //
    // An email verification fires nothing at all — the token never changes — so
    // that path is carried by the gate's `onVerified` callback below rather than
    // by this subscription. Removing that callback would leave email users
    // staring at the gate they had just satisfied.
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void check(); });
    return () => sub.subscription.unsubscribe();
  }, [check]);

  if (verified === null) return <FullscreenLoader />;
  if (verified) return <>{children}</>;

  return (
    <Suspense fallback={<FullscreenLoader />}>
      <MfaGate onVerified={() => setVerified(true)} />
    </Suspense>
  );
}
