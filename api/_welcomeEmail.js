/**
 * The welcome email for an account an ADMIN created by hand.
 *
 * WHY THERE ARE TWO WELCOMES AT ALL
 * A self-signup welcome and this one look similar but do different jobs, and
 * merging them would break both:
 *
 *   • supabase/functions/welcome-email — for people who signed themselves up.
 *     Fired by a database webhook on `profiles` INSERT, carries no credentials,
 *     and says what the account is for.
 *   • this one — for an account the team created FOR someone. It carries a
 *     temporary password, so it must go out on the same request that generated
 *     that password (an async webhook has no way to learn it), and it has to
 *     explain why an account they never asked for exists.
 *
 * They share the shell in `_email.js` and the numbered-steps construction, so
 * the two read as one company. 0105 stamps admin-created profiles as already
 * welcomed at INSERT time, which is what stops the webhook sending a second,
 * passwordless "welcome" alongside this one — two welcomes arriving together,
 * one of them with a password in it, is indistinguishable from a phishing pair.
 *
 * Extracted from api/admin-create-user.js, which also had a private second copy
 * of `sendEmail` pointed at Resend with a different failure posture from the
 * shared one. There is now a single sender.
 *
 * The leading underscore keeps this out of Vercel's /api routing. That is load
 * bearing: the project sits at the 12-function Hobby ceiling, so this had to be
 * a helper the admin routes import, not a route of its own.
 */

import { esc, layout, sendEmail } from './_email.js';
import { buildLoginUrl } from './_accessEmail.js';

const SUPPORT_EMAIL = 'support@mangaimart.com';

const ROLE_LABEL = {
  buyer: 'Buyer account',
  seller: 'Boutique seller account',
  admin: 'Admin console access',
  staff: 'Staff console access',
};

/**
 * What the account is for. Kept factual and scoped to what the role can
 * actually do — the staff line in particular says what the account CANNOT do,
 * so a new employee is not left discovering the limits by hitting them.
 */
const ROLE_DETAIL = {
  buyer: 'You can shop, save wishlists, follow boutiques and track your orders.',
  seller: 'You can set up your boutique, list products, and manage orders and payouts from the seller console.',
  admin: 'You have administrator access, including orders, payouts, users and platform settings.',
  staff:
    'You can work orders and deliveries, approve boutiques, products and catalogue terms, moderate reviews and send buyer updates. Payouts, refunds, expenses, coupons, platform settings and account management stay with the owner.',
};

/**
 * The numbered steps. A table with a round number cell, not a `<ul>`: list
 * bullets and their indentation are one of the few things Outlook and Gmail
 * still disagree about badly enough to notice. Mirrors `pointsTable` in
 * supabase/functions/welcome-email.
 */
function stepsTable(steps) {
  const rows = steps
    .map(
      (step, i) => `
        <tr>
          <td width="34" valign="top" style="padding:0 0 12px;">
            <div style="width:22px;height:22px;border-radius:999px;background:#B02454;color:#FFFFFF;text-align:center;line-height:22px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;">${i + 1}</div>
          </td>
          <td style="padding:1px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4B3840;">${esc(step)}</td>
        </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

/**
 * The credentials card.
 *
 * The password is in a monospace box with wide letter-spacing because it is
 * generated from a deliberately ambiguity-free alphabet (no I/l/0/O — see
 * `generateTempPassword`) and the reader is going to retype it on a phone. A
 * proportional font would undo that work at the last step.
 */
function credentialsCard(email, tempPassword) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EFDCE4;border-radius:14px;background:#FFFAFC;">
      <tr><td style="padding:16px 18px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9D556F;font-weight:700;margin-bottom:10px;">Your sign-in details</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#775D66;margin-bottom:3px;">Email</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14.5px;color:#241019;font-weight:700;word-break:break-word;margin-bottom:12px;">${esc(email)}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#775D66;margin-bottom:5px;">Temporary password</div>
        <div style="display:inline-block;padding:10px 14px;border-radius:10px;background:#FFFFFF;border:1px solid #EDD5DF;font-family:'Courier New',Courier,monospace;font-size:17px;letter-spacing:.1em;color:#651B36;font-weight:700;">${esc(tempPassword)}</div>
      </td></tr>
    </table>`;
}

/**
 * Build the message. Pure — returns what to send, sends nothing, so the caller
 * can compose it BEFORE creating the auth user and still bail out cleanly.
 */
export function buildAdminWelcomeEmail({ email, fullName, role, tempPassword }) {
  const roleLabel = ROLE_LABEL[role] ?? 'MangaiMart account';
  const roleDetail = ROLE_DETAIL[role] ?? '';
  const loginUrl = buildLoginUrl(role, email);
  const greeting = String(fullName ?? '').trim().split(/\s+/)[0] || 'there';

  const steps = [
    'Open your account with the button below.',
    'Sign in with the temporary password above.',
    'Change it to something only you know, and finish your profile.',
  ];

  return {
    to: email,
    replyTo: SUPPORT_EMAIL,
    subject: `Welcome to MangaiMart — your ${roleLabel.toLowerCase()} is ready`,
    html: layout({
      heading: `Welcome, ${greeting}`,
      intro: `The MangaiMart team has created a ${roleLabel.toLowerCase()} for you. ${roleDetail}`,
      bodyHtml:
        credentialsCard(email, tempPassword) +
        `<div style="margin:22px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#241019;">Next steps</div>` +
        stepsTable(steps),
      ctaLabel: 'Access your account',
      ctaHref: loginUrl,
      footerNote: `Please change the temporary password the first time you sign in. If you were not expecting this invitation, write to ${SUPPORT_EMAIL} before signing in.`,
      tagline: 'This is a message about your MangaiMart account, not marketing.',
    }),
    text: [
      `Welcome to MangaiMart, ${greeting}.`,
      '',
      `The MangaiMart team has created a ${roleLabel.toLowerCase()} for you.`,
      roleDetail,
      '',
      'SIGN-IN DETAILS',
      `Email: ${email}`,
      `Temporary password: ${tempPassword}`,
      '',
      'NEXT STEPS',
      ...steps.map((step, i) => `${i + 1}. ${step}`),
      '',
      `Sign in at ${loginUrl}`,
      '',
      `If you were not expecting this invitation, write to ${SUPPORT_EMAIL} before signing in.`,
    ].join('\n'),
  };
}

/**
 * Build and send in one call.
 *
 * Never throws, and never blocks the account: by the time this runs the auth
 * user and the profile row already exist, so a dead mail provider must not turn
 * a successful creation into a 500 that tempts the admin to click Create twice.
 * The caller reports `ok` to the console and shows the temp password so the
 * credentials can be relayed by hand.
 */
export async function sendAdminWelcomeEmail(args) {
  const message = buildAdminWelcomeEmail(args);
  const result = await sendEmail(message);
  if (!result.ok) console.error('[WELCOME_EMAIL_ERROR]', result.error);
  return result;
}
