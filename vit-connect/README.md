# VIT Connect

Mobile-first campus social app for VIT students. React + Vite + Tailwind, Supabase (Postgres, Auth, Storage, Realtime), hosted free on Cloudflare Pages.

**Features:** @vitstudent.ac.in-only sign-up (enforced by a database trigger), image-only posts (max 5, enforced by a DB trigger), likes/comments/share/save/follow, events with RSVP/deadlines/limits/products, UPI boost requests with admin approval, opt-in hangouts/dating with mutual-consent matching, realtime chat with message requests and group chats, notifications, reports/blocking, and an admin dashboard with audit log.

## 1. Run locally (Windows, VS Code)
1. Install Node.js LTS (https://nodejs.org) and Git. Open this folder in VS Code, then open a terminal.
2. `npm install`
3. Copy `.env.example` to `.env` (`copy .env.example .env`) and fill in your Supabase URL and **anon** key (step 2 below).
4. `npm run dev` and open http://localhost:5173
5. `npm test` runs the unit tests. `npm run build` makes the production build.

## 2. Supabase setup
1. Create a free project at https://supabase.com. Wait for it to finish provisioning.
2. **Project Settings → API**: copy the *Project URL* and *anon public* key into `.env`. Never use the `service_role` key in this app.
3. **SQL Editor**: run these files, in order, one at a time (paste, Run):
   `supabase/migrations/001_schema.sql` → `002_rls.sql` → `003_storage.sql` → `004_seed.sql`
4. **Authentication → Providers → Email**: keep *Confirm email* ON (email verification).
5. **Authentication → URL Configuration**: set *Site URL* to your Cloudflare address (e.g. `https://vit-connect.pages.dev`) and add `http://localhost:5173` and your pages.dev address (with `/**`) to *Redirect URLs*. This makes verification and password-reset links work.
6. Storage buckets `avatars`, `posts`, `events` are created by `003_storage.sql` (images only, 2–3 MB limit, writes restricted to the owner's folder).

### Admin account (secure, no password in code)
The only admin is `nightshoree@gmail.com`.
1. **Authentication → Users → Add user → Create new user**: email `nightshoree@gmail.com`, choose your own strong password, tick **Auto Confirm User**. Do this *before* launching publicly.
2. Sign in at `/admin/login`. Admin rights are checked by the database function `is_admin()` in every RLS policy and admin RPC; hiding the page is not the protection.
3. To change the password later: Supabase dashboard → Authentication → Users, or sign out and use "Send password recovery" there.

### UPI payments
Sign in as admin → **Payments** tab: set your UPI ID, payee name, and boost plans/prices. Students then see your UPI ID and a QR code with an amount and reference.
Payments are **not verified automatically**. In **Boosts**, compare the reference/UTR and amount with your UPI/bank app, then Approve. A boost goes live only on approval and expires automatically when its duration ends. (Automatic verification would need a payment gateway, which this project does not claim to have.)

## 3. Deploy free on Cloudflare Pages
1. Push to GitHub: `git init`, `git add .`, `git commit -m "init"`, create a repo on GitHub, `git remote add origin ...`, `git push -u origin main`. `.env` is git-ignored.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build command `npm run build`, output directory `dist`, framework preset *Vite*.
4. **Environment variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy. You get `https://<project>.pages.dev`. SPA routing is handled by `public/_redirects`. Then update the Supabase Site URL/Redirect URLs (step 2.5).

## 4. Tests
- `npm test`: email-domain, image, age, event-status and swipe logic.
- `supabase/tests/security_tests.sql`: paste into the SQL editor after migrations. It covers domain rejection, unique usernames/reg numbers, the 5-post limit and slot freeing, cross-user authorization, event ownership and capacity, boost approval/expiry and audit log, hangout matching (opt-in, mutual gender/activity, no repeats, blocking, 18+), conversation access and message requests. It rolls back all data and prints `PASS:` notices.
- The post limit is race-safe: the insert trigger locks the user's profile row, so concurrent uploads queue and the 6th is rejected.

## 5. Design notes and limits
- Private data (registration number, gender, date of birth) lives in `profile_private`, readable only by its owner and the admin. The registration number appears publicly only as the event "host registration number" you are required to show.
- Admin never reads message content (RLS gives admins no access to messages); stats show counts only.
- Swipe: left→right goes Home, right→left goes Profile. It needs a mostly horizontal gesture and ignores inputs, forms and elements marked `data-no-swipe` (carousels, chip rows, modals). Header buttons give the same navigation.
- Browser alerts work while the app is open. True background push needs a service worker and VAPID keys, which are not configured.
- Rate limits are DB triggers (posts, comments, likes, follows, messages, reports, events). Supabase Auth has its own limits for sign-up/login emails.
- Account deletion removes your files from storage, then deletes the auth user, which cascades to all your rows.

## 6. Troubleshooting
| Problem | Fix |
|---|---|
| Blank page / "Supabase is not configured" | `.env` missing or wrong; restart `npm run dev` after editing. On Cloudflare, add the two env vars and redeploy. |
| "Database error saving new user" | Username or registration number already used, or invalid format (reg no like `22BCE1234`). |
| Verification link goes to localhost | Fix Site URL / Redirect URLs in Supabase (step 2.5). |
| "new row violates row-level security policy" | Migrations not run in order, or you are signed out/suspended. Re-run `002_rls.sql` after `001`. |
| `must be owner of table` / storage policy errors | Run `003_storage.sql` as the default `postgres` role in the SQL editor. |
| Realtime chat doesn't update | `002_rls.sql` adds `messages` and `notifications` to `supabase_realtime`; confirm in Database → Replication. |
| Admin login says not authorised | The admin user must be created with email exactly `nightshoree@gmail.com` and be confirmed. |
| 404 when refreshing a page on Cloudflare | Make sure `public/_redirects` exists in the repo. |
| Images won't upload | Only JPG/PNG/WebP up to 3 MB (avatars 2 MB). |
