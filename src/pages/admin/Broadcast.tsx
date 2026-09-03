import { EmailBroadcast } from '@/pages/admin/EmailBroadcast';

/**
 * Broadcast — one composer, both channels.
 *
 * WHY THIS FILE IS NOW FOUR LINES
 * It used to hold a tab strip and a second, smaller composer of its own: one tab
 * wrote the notification bell, the other wrote email, and the same announcement
 * got written twice by whoever was sending it. The wording drifted between the
 * two every time. They are one screen now — a "Send on" row with a switch per
 * channel, and a single Send that does both in one request.
 *
 * WHAT DID NOT GET MERGED AWAY
 * The channels are still genuinely different, and the difference moved into the
 * switches rather than disappearing:
 *
 *   • The bell is instant, free, and fans out by ROLE. It has no notion of "these
 *     four people", so it is unavailable on a hand-picked audience — the switch
 *     stays visible and says why.
 *   • Email leaves the building under the company's sending domain and cannot be
 *     recalled. It is the channel with the confirm dialog, the test send and the
 *     unsubscribe rules behind it.
 *
 * WHO MAY SEND WHAT
 * Both, for admins and staff alike. Email was admins-only under 0089; the owner
 * widened it on 2026-09-03, which took a change to the `broadcast-email` Edge
 * Function (is_admin → is_staff) and migration 0108 for the history policy.
 * Neither is enforced here — the server still decides, as it should. This
 * component only picks which composer to render, and there is only one now.
 */
export function Broadcast() {
  return <EmailBroadcast />;
}
