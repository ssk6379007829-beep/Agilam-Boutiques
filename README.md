# Agilam-Boutiques
A multi-boutique marketplace web app — Buyer, Seller (boutique owner), and Admin experiences in one React + Supabase app, built from the Agilam Boutiques design.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- React Router v6 (role-based routing — one login, one app, route follows the account's role)
- Supabase (Postgres + Auth + Realtime)

## Setup

1. **Create a Supabase project** at https://supabase.com (free tier is fine).
2. **Run the schema**: open the SQL editor in your project, paste the contents of `supabase/schema.sql`, and run it. This creates all tables, RLS policies, and enables realtime for `messages`/`notifications`.
3. **Email auth**: enabled by default on new Supabase projects (Authentication → Providers → Email). Buyers and sellers sign up with full name + email + password (+ boutique name for sellers) and a profile row (and boutique row for sellers) is created automatically on first sign-in — see `ensureProfile` in `src/auth/AuthContext.tsx`. If your project has "Confirm email" turned on, new users must click the confirmation link before they can sign in.
4. **Create an admin user**: admin sign-in also uses email + password, but admin accounts aren't self-serve — create one manually:
   - Authentication → Users → Add user (email + password).
   - In the SQL editor: `insert into profiles (id, role, full_name, email) values ('<the-user-id>', 'admin', 'Admin', '<email>');`
5. **Copy environment variables**: `cp .env.example .env` and fill in your project's URL and anon key (Project Settings → API).
6. **Install and run**:
   ```
   npm install
   npm run dev
   ```

## App structure

- `/` — splash / role entry (Buyer, Boutique Owner, or Platform Admin sign-in)
- `/auth/signin/:role`, `/auth/signup/:role` — email + password sign in/up for buyers and sellers
- `/admin/login` — email + password sign in for admins
- `/buyer/*` — buyer mobile web app (home, search, boutiques, product detail, wishlist, chat, profile)
- `/seller/*` — boutique owner mobile web app (dashboard, products, orders, earnings, subscription, chat)
- `/admin/*` — desktop admin console (overview, approvals, boutiques, subscriptions, featured, customers, reports, payments, ads)

Role is resolved from the signed-in user's `profiles.role` row — there's no manual role switcher in the shipped app.

Buyer and seller layouts are responsive: on phones they render full-bleed with a bottom tab bar; from the `md` breakpoint up they render as a proportioned boxed app with a top nav bar instead, so the app doesn't look like a narrow strip on desktop. The Admin console is desktop-only by design (sidebar + table-heavy views).

## Notes on scope

- Payments/commission figures on the Admin > Payments screen are computed live from `orders` at an 8% commission rate — there's no separate payment-gateway integration.
- Product photo upload is stubbed (no Supabase Storage wiring yet) — products without an uploaded photo show a soft color-tinted placeholder, matching the source design's placeholder treatment.
