# Welcome email — setup

*Written 2026-08-31, when self-signup buyers and sellers started getting one.*

Until now the only welcome MangaiMart ever sent was the temp-password mail to
accounts an admin typed in by hand. Everyone who signed themselves up — which is
everyone — got nothing: no confirmation the account existed, no sender address in
their inbox to recognise the next message by.

Now a new buyer or boutique owner gets one message, once, seconds after signing
up. It carries no offer and nothing to unsubscribe from; it says what the account
is and gives one button.

---

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| `welcome_email_sent_at` | `profiles`, added by `0105` | The send marker **and** the once-only lock |
| `handle_new_user()` | `0105` replaces 0028's | Pre-stamps the accounts that must never get one |
| Database Webhook | Supabase dashboard | Calls the function on every `profiles` INSERT |
| `welcome-email` | `supabase/functions/` | Claims the row, picks buyer or seller copy, sends |
| `_welcomeEmail.js` | `api/` | The *other* welcome — admin-created accounts, with a temp password |

**Why the webhook is on `profiles` and not `auth.users`:** 0028's trigger already
writes exactly one profiles row per auth user, for every sign-in method —
password, Google, OTP, dashboard-created. One hook there covers all of them, and
it reads the role, name and email the app actually uses rather than raw signup
metadata.

**Why it is an Edge Function and not `api/`:** `api/` holds exactly 12 routes,
the Vercel Hobby ceiling. A thirteenth fails the deploy.

### Who does *not* get one

| | Why | How it is prevented |
|---|---|---|
| Admin-created accounts | They already get the temp-password welcome from `api/admin-create-user.js`. Two welcomes in one minute, one of them carrying a password, reads exactly like a phishing pair. | `admin-create-user` tags the signup `created_by_admin`; `0105` pre-stamps the profile |
| Anonymous guest sessions | No email address at all | `0105` pre-stamps `is_anonymous` users |
| Everyone who signed up before this shipped | We are not mailing the whole back catalogue a "welcome" | `0105`'s backfill stamps every existing profile |
| Admins and staff | Same reason as row 1 | Pre-stamped above, plus a role check in the function |

---

## 1. Apply the migration  ⟵ *your hand*

Run `supabase/migrations/0105_welcome_email.sql` in the Supabase SQL editor. It is
idempotent. **Do not `supabase db push`** — see CLAUDE.md rule 1.

Check it landed, and that nobody is queued:

```sql
select count(*) from profiles where welcome_email_sent_at is null;
-- expect 0 right after applying
```

Do this **before** creating the webhook in step 3. The order matters: the column
has to exist before the function can claim a row, and the backfill has to have
run before the first hook fires.

---

## 2. Deploy the Edge Function  ⟵ *deployable from a Claude session*

```bash
supabase functions deploy welcome-email
```

Leave JWT verification **on** — no `--no-verify-jwt` here. The webhook sends the
service-role key as its `Authorization` header, so the gateway check and the
function's own check agree.

Secrets, if they are not already set from broadcast-email (they are shared):

```bash
supabase secrets set RESEND_API_KEY=... EMAIL_FROM="MangaiMart <noreply@mangaimart.com>" APP_URL=https://mangaimart.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform —
do not set them by hand.

Without `RESEND_API_KEY` the function is **inert, not broken**: it releases the
claim and returns an error in the body, so the row stays visibly owed and can be
drained later. It never 500s.

---

## 3. Create the Database Webhook  ⟵ *your hand*

This one is yours because it carries the service-role key in a header, and a
secret pasted into a checked-in migration is how the daily report ended up
POSTing a literal `<REPORT_TOKEN>` and 401ing in silence for weeks. The dashboard
stores it out of the repo.

**Dashboard → Database → Webhooks → Create a new hook**

| Field | Value |
|---|---|
| Name | `welcome_email` |
| Table | `public.profiles` |
| Events | **Insert** only — not Update, not Delete |
| Type | Supabase Edge Functions |
| Edge Function | `welcome-email` |
| Method | `POST` |
| Timeout | `5000` ms |
| HTTP header | `Authorization` → `Bearer <your SUPABASE_SERVICE_ROLE_KEY>` |

Ticking Update as well is the mistake to avoid — it would wake the function on
every profile edit in the app. It would not send anything (the function refuses
any `type` that is not `INSERT`, and the row is claimed anyway), but it fills the
delivery log with noise that hides real failures.

Raise the timeout from the 1000 ms default: a Resend round trip is comfortably
longer than a second, and every delivery would otherwise be logged as a timeout
even though the mail went out. The timeout only governs how long Postgres waits
for the reply — the request is already on its way and the send completes either
way.

---

## 4. Verify

Sign up a throwaway buyer at `/auth/signup/buyer`, then:

```sql
select email, role, welcome_email_sent_at
  from profiles order by created_at desc limit 5;
```

`welcome_email_sent_at` should be filled within a second or two. If it is filled
and no mail arrived, the function thinks it sent — check Resend's own log next,
not ours.

Then the seller side at `/seller/register`, which should get the boutique copy
("let us get your boutique open") and a button to the seller console rather than
the storefront.

Function logs are under **Edge Functions → welcome-email → Logs**:

```
[welcome-email] sent { userId: ..., role: 'buyer' }
```

---

## The queue, and resending

The one query worth knowing. Anything old and unstamped is somebody who never got
their welcome:

```sql
select id, email, role, created_at
  from profiles
 where welcome_email_sent_at is null
   and created_at < now() - interval '1 hour'
 order by created_at desc;
```

It should always be empty. Rows in it mean one of three things: the webhook is
not reaching the function, `RESEND_API_KEY` is unset, or Resend refused the send.
The function log says which.

To send one by hand, POST the user id straight at the function — this is the
`{ user_id }` shape it accepts alongside the webhook envelope:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/welcome-email \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<the profile id>"}'
```

To send a *second* one to somebody who already got theirs, clear the marker first
— the function will refuse otherwise, which is the point of it:

```sql
update profiles set welcome_email_sent_at = null where id = '<the profile id>';
```

---

## Changing the copy

Both welcomes live in one place each, and the brand shell is duplicated in three:

- **Self-signup copy** — the `COPY` table at the top of
  `supabase/functions/welcome-email/index.ts`. Buyer and seller side by side, so
  a change to one is an obvious prompt to look at the other.
- **Admin-created copy** — `api/_welcomeEmail.js`.
- **The shell** — `layout()` in `api/_email.js`, `shell()` in
  `broadcast-email/index.ts`, and `shell()` in `welcome-email/index.ts`. Change
  all three together or the emails start looking like two companies.

Three things stay out of the welcome on purpose: a discount code, a referral ask,
and anything with an unsubscribe link. It is the first message we ever send —
its job is to put the sender address in their inbox and say what the account is.
Selling starts with the second message, and that one is a broadcast, which has
consent and unsubscribe built in (`0089`).

Colours in all of these are literal hex, the one place the `--ag-*` token rule
does not apply: a mail client has never seen our stylesheet and cannot resolve a
CSS variable.
