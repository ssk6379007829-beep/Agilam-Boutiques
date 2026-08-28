# Two-factor authentication

Built 2026-08-23 (TOTP), extended 2026-08-28 with an **emailed code** as an
equal second method. Either one is a complete second factor, and both are
enforced by Postgres rather than by React.

**Nothing here is live until migrations 0099, 0100 and 0102 are applied and the
`mfa-recovery` Edge Function is deployed.** The order matters — see the runbook.

---

## What was decided

| Question | Answer |
|---|---|
| Who | Admin + staff (whole console), sellers (bank/payout details only) |
| Method | The user's free choice of a TOTP authenticator app **or** a code emailed to a security address (0102) |
| Enforcement | Required, and full parity — either method opens the whole console |
| Recovery | Ten single-use backup codes, plus an admin reset from the Users page |
| Rollout | 0099 enrol → 0100 enforce → 0102 add the email method |

Buyers are untouched. Ordering already requires an account (0069); it does not
require an authenticator, and forcing one on a shopping account would cost
conversion for no meaningful gain.

---

## Why the app path works the way it does

> **2026-08-28.** This section explains the original TOTP-only design. Its
> reasoning is still exactly right about *why an emailed code cannot ride on
> `aal2`* — which is why 0102 does not try to. Read it, then read "The email
> method (0102)" below for the mechanism that was built instead.

This is the load-bearing decision, and it follows directly from rule 7 of
`CLAUDE.md`: **RLS is the security boundary.**

The browser holds a real Supabase JWT. Anything our React app can read, a
stolen password can read by calling PostgREST directly with that token —
without ever loading our JavaScript. So a second factor checked in React gates
the UI, not the data. It is a padlock with no wall beside it.

Supabase's own TOTP factor is different in one way that matters: on a successful
challenge GoTrue **re-mints the JWT with `aal: "aal2"`**. That claim arrives in
Postgres as part of `request.jwt.claims`, which means a *policy* can test it.
That is the whole difference between 2FA and the appearance of 2FA.

It is also free — no SMS provider — and needs no new `api/` route, which matters
because `api/` sits at the 12/12 Vercel Hobby function ceiling.

---

## The email method (0102)

Added 2026-08-28, because requiring an authenticator app is a real barrier for
staff who will not install one, and "install this app or you cannot do your job"
is a support problem that ends in shared passwords.

### The constraint it had to work around

Everything in the section above still holds: **GoTrue has no email factor**, and
it will never mint `aal2` for one. An email-verified session is `aal1` for its
entire life. So the emailed code could not be bolted onto the existing
mechanism, and checking it in React was never on the table — that is the
padlock-with-no-wall this document already rejects.

### What was built instead

The code is verified by the **service role**, inside `mfa-recovery`, and the
result is written to a table keyed by the **`session_id` claim of the very JWT
that will use it**. 0102 then widens `is_admin()` / `is_staff()` from

```
role is right AND jwt.aal = 'aal2'
```

to

```
role is right AND ( jwt.aal = 'aal2'
                    OR a live mfa_email_sessions row for this jwt.session_id )
```

The database is still what decides. There are simply two things it will accept.
Every one of the ~72 policy clauses inherits the second one for free, the same
way they inherited the first from 0100 — no policy is touched.

**Binding to `session_id`, not to `user_id`, is the whole security property.** A
stolen password opens a *different* session with a different `session_id`, so
one browser's verification grants another browser nothing. Sign out and the row
is orphaned. It cannot be a "remember this device" by accident, because a new
sign-in is a new session id.

### Why the security address must differ from the login email

Console accounts sign in with **email + password**, and reset that password by
email. Sending the second factor to the same inbox would make one mailbox
sufficient for both halves — a single factor wearing two hats.

So the address is a *separate* one the user registers, and:

* the first registration is proved by receiving a code at it;
* every change afterwards additionally requires an already-verified session
  (by either method), and ends every session the old address had verified;
* the rule is enforced in `mfa_email_challenge_create`, not only in the Edge
  Function — a rule the caller alone enforces is one refactor from gone.

### Honest strength

Weaker than TOTP. A mailbox is a softer secret than a device and is reachable
through forwarding rules and the mail provider. It is still a real second
factor: the code travels somewhere the browser holding the password does not
reach. The app is therefore offered first everywhere a choice is shown, and a
line of copy says why — but a user who picks email is not second-class, and
gets the same console and the same backup codes.

### The limits that a six-digit code makes mandatory

Backup codes are 64 bits and need no rate limiting (0099 says so explicitly).
A six-digit code is twenty bits, so 0102 carries its own, in SQL:

| Limit | Value |
|---|---|
| Code lifetime | 10 minutes |
| Wrong attempts per code | 5, then locked |
| Resend cooldown | 60 seconds |
| Sends per account per hour | 6 |
| Live codes per account | 1 — a new one voids the last |

Codes are stored as sha256 through 0099's `mfa_hash_code`, never in clear, and
are generated in the Edge Function so the clear text never crosses the database
boundary in either direction.

### What silently undoes it

**Re-running 0100 after 0102.** Its `create or replace` restores the aal2-only
bodies and locks out every email-verified admin with no error message — the same
shape of failure as `supabase db push` replaying `schema.sql`. If you ever
re-apply 0100, re-apply 0102 straight after.

```sql
select prosrc from pg_proc where proname in ('is_admin','is_staff');
```

The 0102 bodies mention `mfa_email_sessions`. The 0100 ones do not.

## Why there is no "remember this device"

The assurance level is a property of the JWT, not of the browser. A remembered
device is still holding an `aal1` token, so RLS would hand it an empty console.
The trust would have to be honoured in React, over data the database is
refusing — which cannot work.

It costs less than it sounds. Supabase sessions persist in `localStorage` and
keep their `aal2` claim across refreshes, tab closes and reboots. A code gets
typed on a real sign-in, not daily.

## Why backup codes clear the factor instead of logging you in

Only GoTrue can mint an `aal2` JWT, and only for a real TOTP challenge. A backup
code that "logged you in" would have to be honoured by us at aal1 — the theatre
described above.

So a backup code does the one thing it honestly can: it proves ownership well
enough to **remove** the lost factor. The user then enrols a new authenticator
and challenges normally. Same mechanism as the admin reset.

---

## How ~72 policy clauses got 2FA from a two-function change

Every console-visible table in this series is gated by a policy saying
`is_admin()` or `is_staff()` — roughly seventy clauses across thirty migrations.

0100 does not touch a single policy. It changes what those two functions
**mean**: an admin is now an admin-who-has-completed-a-challenge. Every policy
that already trusts them inherits the requirement at once, and so does every
trigger and RPC guarding on them (the role-change guard from 0010/0086, the
settlement lockdown in 0072, coupon writes, all of it).

Rewriting seventy clauses by hand would have been a large mechanical diff over
the exact surface that has already taken the site down twice (0086 blanked the
storefront, 0087 fixed it). Each edit would have been a fresh chance to repeat
it.

The assurance level is read **inline** in both functions rather than through the
`mfa_verified()` helper. That is 0087's lesson applied: Postgres checks EXECUTE
on every function a policy touches *before* testing a single row, so a helper
the caller cannot execute fails the whole read `42501` instead of returning
fewer rows. `is_admin()` is reachable from policies `anon` evaluates
(`profiles: self select` among them) and `mfa_verified()` is revoked from anon.
`current_setting` is callable by every role, so inlining removes that entire
failure class.

### The one way this silently undoes itself

`is_admin()` is originally defined in `supabase/schema.sql`. Anything replaying
that file — notably `supabase db push`, which rule 1 forbids — restores the old
body and switches enforcement off across the console **with no error message**.

Check with:

```sql
select prosrc from pg_proc where proname in ('is_admin','is_staff');
```

The fix is to re-run 0100, which is idempotent.

---

## The seller side is deliberately weaker

Sellers are asked for a code at exactly one place: the bank account MangaiMart
pays them into, and only once an account is already on file.

The fraud worth stopping is a stolen password quietly repointing an established
seller's settlements at someone else's bank — silent, and by the time it surfaces
the money has moved. A seller entering details for the first time has nothing to
redirect, so gating that would buy no security and would drop a QR code into the
middle of a seven-step registration.

**This one is enforced by the app, not the database.** A seller's boutique row is
owner-scoped by `owner_id = auth.uid()`; the policy carries no assurance level.
Someone with the password who knows how to call PostgREST directly can still
write the column. Closing that means adding `aal2` to the boutiques UPDATE
policy, which would break every seller who has not enrolled. That is a trade for
the day sellers are universally enrolled — not before.

---

## Runbook

### 1. Apply 0099

```
supabase/migrations/0099_two_factor_auth.sql
```

Safe on a live database. Adds one table and five functions; changes no existing
policy, function body or row. **Nobody's access changes when it runs.**

### 2. Deploy the Edge Function

```bash
supabase functions deploy mfa-recovery
```

With JWT verification **on** (the default) — unlike `unsubscribe`. Every caller
must already hold a session; an anonymous request has nothing to recover.

### 3. Deploy the app

The console now shows the enrolment screen to anyone at aal1. At this stage it
is a prompt, not a wall: the database is not yet enforcing anything, so an
account that dismisses it still works.

### 4. Every admin and staff member enrols

Sign in to the console → the gate appears → scan the QR → enter the six-digit
code → **save the ten backup codes**. They are shown once and stored only as
sha256 hashes; there is nowhere to read them back from.

### 5. Apply 0100

```
supabase/migrations/0100_two_factor_enforcement.sql
```

This is the one with teeth. It **refuses to apply** unless every active
admin/staff profile has a verified factor, and names whoever is missing:

```
0100 not applied: 1 console account(s) have not enrolled in 2FA yet.
  staff@example.com
Applying now would lock them out of the admin console entirely.
```

It also refuses if there is no active admin at all.

### 6. Apply 0102 — the email method

```
supabase/migrations/0102_two_factor_email.sql
```

Safe on a live database and idempotent. It only ever *widens* what `is_admin()`
accepts, so unlike 0100 it cannot lock anybody out — an account with an
authenticator carries on exactly as before. It refuses to apply if 0099 was
never applied.

Redeploy `mfa-recovery` with it: the email actions live there.

```bash
supabase functions deploy mfa-recovery
supabase secrets set RESEND_API_KEY=... EMAIL_FROM=...
```

Without `RESEND_API_KEY` the email method reports "Email is not configured on
this environment yet" and refuses to pretend it sent anything. The app method is
unaffected.

### Rollback

Two `create or replace` statements at the bottom of 0100, ready to paste into
the SQL editor. They restore pre-0100 behaviour on the next statement — no
sign-out needed. Rolling back leaves the app's 2FA screens working, so the
console keeps asking for a code; it just stops being the database that insists.

---

## Where 2FA appears in the UI

There are three places, and only one of them is a page you navigate to.

1. **The gate** — not a menu item. `RequireRole` hands any unverified console
   session to `RequireMfa`, which renders the method choice (nothing set up
   yet), the QR, or a keypad *in place of* the console. You do not find it; it
   finds you. An account with both methods gets the app keypad plus an
   "Email me a code instead" link; an email-only account gets its code sent
   automatically on arrival.
2. **"Your security" card** — admin **Settings**, top of the page, and
   **StaffHome** for employees. Staff cannot open Settings (`STAFF_ROUTES`), so
   the same component is mounted in both rather than living somewhere half the
   console cannot reach. Shows registered devices, the security address (change
   or remove), backup codes remaining, Regenerate, and Add a device.
3. **Users → `lock_reset`** — resets somebody *else's* 2FA. Hidden for your own
   row, and only shown for admin/staff who are actually enrolled, so it is
   invisible everywhere until people start enrolling.

### There is no "turn two-factor off"

Deliberate, and the one piece of this worth not "fixing" later. After 0100/0102
an account with no factor of either kind can never satisfy `is_admin()`, and the
console requires it — so a disable button is a silent, permanent self-lockout
whose only remedy is pasting the rollback SQL into the Supabase editor.
`removeAuthenticator` drops a **spare** device and refuses to remove the last
one, counting a security address as a factor; the `email-remove` action refuses
the same way, and does it on the server. Clearing a factor
for real is an admin action against someone else's account, through
`mfa-recovery`, where the person doing it still has a working console.

## Recovery paths, in the order to try them

1. **The other method** — if they have both, the challenge screen switches
   between them. Cheapest fix there is, and the reason to encourage both.
2. **Backup code** — on the challenge screen, "Use a backup code". Clears
   **every** factor, app and email alike; they set a new one up immediately. It
   clears both on purpose: a reset that left the security address behind would
   hand a recovered account straight back to whoever had been reading its codes.
3. **Admin reset** — console → Users → the `lock_reset` action on a console
   account that has 2FA on. Clears their factors *and* their unused backup codes
   (those were tied to factors that no longer exist). Lands in the audit trail
   as `mfa.admin_reset`; the Edge Function re-checks the caller is a live admin
   at aal2 rather than trusting the screen.
4. **Nothing left** — if the sole admin loses every method and their codes with
   0100 applied,
   the way back is the rollback snippet in the Supabase SQL editor. This is the
   argument for a second admin account existing.

A user who runs their backup codes down to zero is topped up with a fresh set
automatically on their next successful challenge.

---

## Files

| Path | What |
|---|---|
| `supabase/migrations/0099_two_factor_auth.sql` | Table, helpers, backup-code RPCs. Enforces nothing |
| `supabase/migrations/0100_two_factor_enforcement.sql` | Pre-flight + the `is_admin()`/`is_staff()` change |
| `supabase/migrations/0102_two_factor_email.sql` | The email method: three tables, the widened `is_admin()`/`is_staff()`, the rate limits |
| `supabase/functions/mfa-recovery/index.ts` | Backup-code redemption, admin reset, and the three `email-*` actions |
| `src/lib/mfa.ts` | Client wrapper over `supabase.auth.mfa` **and** the email actions |
| `src/components/auth/MfaGate.tsx` | Method choice / enrol / challenge / recover screen |
| `src/components/auth/MfaStepUp.tsx` | Inline gate for the seller bank block |
| `src/components/admin/SecurityCard.tsx` | "Your security" — devices, backup codes, add a device. Mounted on Settings **and** StaffHome |
| `src/auth/RequireMfa.tsx` | Console gate, wired into `RequireRole` |

The gate is lazily loaded and builds to its own ~8.8 kB chunk, so none of it
lands in the storefront's entry bundle.
