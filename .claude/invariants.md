# Invariants — Non-Negotiable Global Laws

These are never overrideable by a feature rule, by "it looks cleaner," or by an implicit
inference. They may only be broken if the user explicitly names the invariant and confirms
they want it broken. Otherwise: **stop and flag, do not proceed.**

## Scope Control (the most important one)

- Change **only** what the task requires. The blast radius of an edit must match the
  intent of the request.
- Never refactor, rename, reformat, dedupe, or "clean up" code outside the task's scope —
  even if it is clearly improvable. Note it; do not do it.
- A change that is *locally correct* but *globally harmful* (alters shared behavior, breaks
  a contract elsewhere, changes a public export, changes a response shape) is a **defect**,
  not an improvement.
- "This pattern is repeated, I'll extract it" is a proposal, not an action. Propose it.

## Documentation / Memory

- Never delete `docs/**`, `swagger/**`, `.claude/*.md`, or any `FEATURES/**` doc without
  explicit instruction naming the file.
- Never replace a doc with an alias, stub, or "see other file" pointer.
- Never auto-deduplicate or auto-condense docs. Structure may improve; usability must not
  drop. If a restructure would reduce usability, **stop and ask.**
- `memory.md` is append-only. Do not rewrite or prune past entries.

## API Contract

- This repo is **the contract** for `MathPro_Frontend` and `mathpro_admin`. Before changing
  any route path, request/response shape, status code, or DB column: state which client(s)
  consume it, and prefer additive/backward-compatible changes. A breaking change is
  cross-repo — enumerate the client updates, don't defer them silently.
- Response envelope is `{ success, data, message }` on success and
  `{ success: false, error, message }` on failure (HTTP 400/401/403/410/500 per
  `AGENTS.md`). Don't introduce a different envelope shape for new endpoints.
- Vocabulary: the DB/API use `bundle`. Never rename to "Combo" in this repo — that's a
  Frontend display-only convention.
- `swagger/user.yaml` is the contract reference — keep it in sync when changing a
  documented route.

## Auth

- JWTs are issued **only** by this repo and decoded identically by both clients. Identity
  claims (`id`, `name`, `type`, `roles`, `permissions`, `exp`, `createdAt`) and `exp`
  semantics must not drift — a change here breaks both clients' auth simultaneously.
- `JWT_SECRET` comes from `process.env` — never hardcode a secret or default it in code.
- `super_admin` role (`util/constants.js` → `SUPER_ADMIN_ROLE_NAME`) must remain
  non-deletable and non-modifiable at the service layer (`roleService.js`) — this is
  enforced server-side and both clients rely on that guarantee.
- New permission strings are defined in `util/permissions.js` (`PERMISSIONS` object) as the
  single source of truth — don't check ad-hoc strings in route/controller code.

## Database

- Migrations are sequential numbered SQL files in `database/migrations/`
  (`000_*.sql`, `001_*.sql`, …) run via `database/runMigration.js`. Never edit a migration
  that has already been applied — add a new numbered migration instead.
- Never run a migration against production without the user's explicit confirmation.

## Platform

- Plain CommonJS Node (Express 4), **no TypeScript**. `npm run lint` is a syntax check only
  (`node -c app.js && node -c index.js`) — it does not catch logic errors. Don't rely on it
  as a substitute for testing the actual route.
- Never commit code with a syntax error — `npm run lint` must pass.