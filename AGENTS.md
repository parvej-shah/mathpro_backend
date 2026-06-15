# MathPro Backend (`mathpro`) — Operating Contract

> Cross-tool agent instructions (Codex, Cursor, Gemini, Windsurf, Claude, etc.).
> Claude reads this via `CLAUDE.md` (`@AGENTS.md`); other tools read `AGENTS.md` directly.
> Keep this file the single source of truth — do not duplicate it into tool-specific files.
> Workspace-level orientation (how the three repos fit together) lives in the **parent
> folder's** `AGENTS.md`. Read that first if a task spans repos.

## What this repo is

The **single source of truth** for the MathPro product. Express 4 + PostgreSQL API that
owns the contract consumed by **both** clients (`MathPro_Frontend`, `mathpro_admin`):
auth/JWT, DB schema, payments (SSLCommerz), file storage (AWS S3), PDFs/certificates, email.

- **Stack:** Express 4, PostgreSQL via `pg`, `jsonwebtoken`, `@aws-sdk/client-s3`,
  `sslcommerz-lts`, `nodemailer`, `pdf-lib`, Swagger (`swagger-jsdoc` + `swagger-ui-express`).
- **Run:** `npm run dev` (nodemon → `dev.js`) or `npm start` (`index.js`). Port `8000`
  (`PORT`, default 8000).
- **Verify:** `npm run lint` — this is a **syntax check only** (`node -c app.js && node -c
  index.js`), not a full linter. There is no TypeScript here; it's plain Node/CommonJS.

## You are the contract — changes ripple to two clients

Before changing any **route path, request/response shape, status code, or DB column**:

1. State which client(s) consume it — Frontend (`src/api.config.ts` → `BACKEND_URL`),
   Admin (`NEXT_PUBLIC_BASE_API_URL`), or both.
2. Prefer **additive / backward-compatible** changes. A breaking change to a shared
   endpoint is a cross-repo task — the client updates belong to the same unit of work and
   must be enumerated, not deferred silently.
3. Keep auth consistent: this repo **issues** the JWT both clients decode. Identity claims
   and `exp` semantics must not drift.
4. Vocabulary: the DB/API use `bundle`. That stays. (The student Frontend *displays*
   "Combo" — that's a client concern, not yours.)

## Structure

```
index.js / app.js        Express app + server bootstrap (dev.js / dev_stable.js for dev)
routes/                  Route definitions — contact, in/, managerial/, user/
controllers/             Request handlers — base, contact, in/, managerial/, user/
service/                 Business logic + data access (authMiddleWares, base, user/, …)
database/                migrations/ + runMigration.js  (raw SQL, pg)
docs/                    Extensive API specs + frontend integration guides (see below)
swagger/                 user.yaml — OpenAPI spec; the contract reference
util/, scripts/, assets/, uploads/
```

## Docs — read before changing or adding an endpoint

`docs/` is the authoritative API reference. Consult the relevant one first:

- `docs/frontend-guide-user.md`, `docs/frontend-guide-admin.md` — client integration guides.
- `docs/JWT_TOKEN_SYSTEM_FRONTEND.md` — the shared auth token contract.
- Feature specs: `COURSE_DIRECTORY_API_SPEC.md`, `DASHBOARD_MY_COURSES_API_SPEC.md`,
  `BOOKS_*`, `ASSIGNMENT_API_DOCUMENTATION.md`, the `managerial_*` folders, `new_quiz_docs`,
  `analytics/`, etc.
- `swagger/user.yaml` — keep it in sync when you change a documented route.

## Document map (`.claude/`)

| File | Authority | Read when |
|---|---|---|
| `.claude/invariants.md` | **Non-negotiable.** Global laws (contract stability, auth, migrations). Never overrideable, even on explicit request without the user acknowledging the override. | Always — before any code change. |
| `.claude/conventions.md` | Route -> Controller -> Service pattern, naming, response shape, auth middleware. | Before writing or editing any file. |
| `.claude/memory.md` | Append-only execution log. Continuity across sessions. | Start of session; append at end. |
| `.claude/FEATURES/<feature>/purpose.md` | Domain ownership + route/controller/service map for that feature. | Before touching anything under that feature's surface. |
| `.claude/FEATURES/<feature>/rules.md` | Feature-level constraints + guardrails. | Same. |
| `docs/**`, `swagger/user.yaml` | API/integration guides and the OpenAPI contract (table above). | Before changing or adding an endpoint. |

`invariants.md` > `conventions.md` > feature `rules.md` > `docs/`/`swagger/`.
If a feature rule conflicts with an invariant, the invariant wins and you stop and flag it.

### Routing — where work goes

| Touching… | Owner doc to read first |
|---|---|
| `routes/{user,managerial}/course.js`, `bundle.js` (+ V2 variants), `service/managerial/{course,bundle,courseV2,moduleV2,featuredCourse,courseImportExport}.js` | `.claude/FEATURES/course-bundle/` |
| `routes/managerial/role.js`, `service/managerial/roleService.js`, `util/permissions.js`, `util/constants.js` | `.claude/FEATURES/roles-permissions/` |
| `service/authMiddleWares.js` | `.claude/conventions.md` § Auth + `.claude/invariants.md` § Auth |
| `database/migrations/**` | `.claude/invariants.md` § Database |
| any route/controller/service not listed above | `.claude/conventions.md` § Route -> Controller -> Service pattern + the relevant `docs/*.md` |

### Execution order for a typical task

1. Read `.claude/invariants.md` + `.claude/conventions.md` (cheap, always).
2. Identify the feature; read its `FEATURES/<feature>/purpose.md` + `rules.md` if it has
   one, else the relevant `docs/*.md` / `swagger/user.yaml`.
3. State which client(s) consume the route(s) you're touching (invariants § API Contract).
4. Make the minimal change. Stay in scope.
5. `npm run lint` (syntax check) clean.
6. Append a one-line entry to `.claude/memory.md` (what changed, why, scope, clients affected).

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with the project-specific
instructions above as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- Backend-specific: if a request is ambiguous about *which endpoint* or *whether the API
  contract changes*, resolve it first and name the consuming client(s).

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently (this repo is plain CommonJS Node).
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require
constant clarification. For a contract change, the check includes the server behavior **and**
each client that consumes it.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due
to overcomplication, and clarifying questions come before implementation rather than after
mistakes.

## Repo-local scratch

- Keep repo-local TODO/plan notes here. Cross-repo backlog lives in the parent `todo.md`.
- This repo is a **local-only git repo** (no remote). It commits separately from the others.
