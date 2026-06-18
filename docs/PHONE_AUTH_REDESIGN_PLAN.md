# Phone-Based Auth Redesign — Plan

> Repo: `Math_Pro_backend` (the contract). Consumers: **Frontend** (`/admin/auth/*`).
> Admin panel login (type 1/2) shares the `login`/`google` endpoints — changes must stay
> backward-compatible for it.

## Decisions (locked)

1. **Phone-primary, email still works.** New signups: phone + password + OTP. Existing
   email accounts keep logging in by email and may add a phone later. `login` accepts a
   phone OR an email identifier. No forced migration.
2. **Sessions: `auth_session` table + `sid` claim in JWT, validated per request.** Max 2
   active sessions/user; 3rd login deletes the oldest → that device 401s on next request.
3. **Hardening this pass:** enforce OTP on registration; OTP rate-limit + attempt cap;
   remove dead `in_auth` path.

## Identity model (managerial_auth, type=3 regular)

- `login` = canonical credential string. For phone signups it stores the **phone**; for
  legacy/email signups it stays the **email**. Unique (existing constraint).
- `phone` column = normalized BD phone (`01XXXXXXXXX`), unique among regular users (partial
  unique index, NULL allowed for legacy email-only accounts).
- `email` column = optional; used for Google match + notifications.
- `profile.auth_providers` = `['password','google']` (existing pattern, reused).
- `profile.phone_verified` / `profile.email_verified` booleans.

## Account-linking rules

| User registered with | Then does | Result |
|---|---|---|
| Phone + password (+ optional email) | Login with Google, Google email == stored email | Same account; add `google` provider |
| Phone + password, no email | Login with Google | New separate account UNLESS they link from settings (out of scope here) |
| Google (email only) | Add phone + password + verify OTP | Same account; set phone, add `password` provider |
| Google (email only) | Login with phone | Allowed once phone is added+verified |

Match precedence on Google login: `phone? no` → match by **verified email** → else create.

## Endpoints (`/admin/auth/*`, all additive/compatible)

- `POST /request-otp` — body `{ contact }`. Now accepts **phone or email** (detectContactType).
  purpose `registration`. Rate-limited.
- `POST /verify-otp` *(new)* — body `{ contact, otp }`. Optional standalone verify.
- `POST /register` — body `{ name?, login, password, otp }`. `login` = phone or email.
  **OTP now required and verified.** Sets `phone`/`email` + verified flag accordingly.
- `POST /login` — body `{ login, password }`. `login` = phone or email. Detects type,
  looks up by phone or email. Creates a session (see below). **Admin login unchanged** —
  admins log in by email; same code path, just broader identifier detection.
- `POST /google` — match by email as today; create session.
- `POST /forgot-password` — `{ contact }` phone or email → OTP.
- `POST /reset-password` — `{ contact, otp, newPassword }` → verify OTP, update.
- `POST /link-phone` *(new, authenticated)* — `{ phone, password, otp }` for Google-first
  users to add phone+password.
- `POST /logout` *(new, authenticated)* — delete current session row.
- `GET /sessions` *(new, authenticated, optional)* — list active devices.

## Sessions / 2-device limit

New table:

```sql
auth_session(
  id           serial primary key,
  user_id      integer not null references managerial_auth on delete cascade,
  session_id   uuid not null unique,        -- the sid embedded in JWT
  user_agent   varchar(255),
  ip           varchar(64),
  created_at   timestamp default now(),
  last_seen_at timestamp default now()
)
-- index on (user_id, created_at)
```

- On any successful login/register/google/link: `INSERT` a session, embed `session_id` in
  the JWT payload (`sid`). Then `DELETE FROM auth_session WHERE user_id=$1 AND session_id
  NOT IN (2 newest)` → enforces max 2, evicts oldest.
- Middleware (`authenticateUser` and the RBAC ones used by student routes) must, **for
  regular users only**, verify `sid` still exists; if not → 401 `SESSION_REVOKED`.
  Admin/permission tokens can be exempted to avoid disrupting admin panel (decision point
  during impl — likely apply session check only when `decoded.type===3`).
- JWT keeps 7d `expiresIn`; session row is the authoritative liveness signal.

## OTP hardening

- **Enforce on register:** `register` calls `verifyOTP(contact, otp)` and aborts if invalid.
- **Rate limit requests:** per-contact cooldown (e.g. 60s between sends) + daily cap
  (e.g. 5/day). Track via `otp` rows (`timestamp`) — no new table needed.
- **Attempt cap:** add `attempts` column to `otp`; lock a code after N (e.g. 5) bad tries.
- **Single active OTP:** mark prior unused OTPs for a contact used when issuing a new one.
- Keep dev-only `response.otp` gated on `NODE_ENV==='development'`.

## Remove dead `in_auth`

- Delete `routes/in/auth.js`, `controllers/in/auth.js`, `service/in/auth.js`, the mount in
  `app.js` (`/in/auth`), and swagger entries in `docs/index.js` (`/in/auth/*`).
- Migration to `DROP TABLE in_auth` (confirm no other code references it — grep clean except
  these files).

## Migrations (new, additive)

1. `0XX_auth_session.sql` — create `auth_session`.
2. `0XX_managerial_auth_phone_unique.sql` — partial unique index on `phone` where type=3
   and phone is not null.
3. `0XX_otp_attempts.sql` — add `attempts int default 0` to `otp`.
4. `0XX_drop_in_auth.sql` — drop legacy table.

## Frontend changes (same unit of work — enumerate, coordinate)

- `auth/login` — accept phone OR email in the identifier field; copy "ফোন নম্বর বা ইমেইল".
- `auth/register` — phone field + OTP step (request → enter OTP → set password). Display
  copy in Bengali; "Combo" vocab unaffected.
- `auth/forgot-password` — allow phone, OTP via SMS.
- Handle new `SESSION_REVOKED` 401 → force logout + redirect to login.
- Optional: "Link phone" in settings for Google-first users; active-devices list.

## Verify (per AGENTS.md)

- Backend: `npm run lint` (syntax) clean; run migrations on a dev DB; manual curl of each
  endpoint (request-otp → register w/ OTP → login → 3rd-device eviction → reset-password →
  google link).
- Frontend: `npx tsc --noEmit` + `npm run lint`; manual flow against local backend (:8000).
- Admin: confirm admin login (email, type 1/2) still works unchanged.
