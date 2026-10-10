# MathPro Backend — Refactoring Plan

> Status: **IN PROGRESS** (started 2026-10-10 on branch `refactor/phase-0-1`). Decisions in §5 are answered.
> Method: [refactoring.guru](https://refactoring.guru/refactoring) — identify *code smells*,
> fix each with a named *refactoring technique*, in small behavior-preserving steps, with a
> test safety net in place first. No new features ride along with a refactor.
> Governing rules: `.claude/invariants.md` (contract stability, auth, migrations) still apply.
> Every task below is **behavior-preserving for both clients** unless it is explicitly marked
> **CONTRACT** — those need a client-side check/change in the same unit of work.

---

## 1. Ground rules (from refactoring.guru, adapted to this repo)

1. **Safety net first.** "Refactoring without tests is just changing code." This repo has
   **zero automated tests** and `npm run lint` is only `node -c`. Phase 0 is non-optional.
2. **Small steps, always green.** Each task is one PR-sized change; the app runs and tests
   pass after every task. No "big-bang" rewrite branch.
3. **Refactor ≠ feature work.** Don't fix bugs or add behavior inside a refactor commit. Bugs
   found along the way are logged (§7) and fixed in their own commit.
4. **Rule of three.** Extract shared code only when the duplication is real (≥3 sites, or 2
   sites that must change together).
5. **Contract is frozen.** Route paths, status codes, response envelope
   (`{success,data,message}` / `{success:false,error,message}`), JWT claims, DB columns do not
   change unless a task is tagged **CONTRACT** and the client follow-up is listed.
6. **Every task ends with:** tests green → `npm run lint` → swagger/docs untouched or synced →
   one-line append to `.claude/memory.md`.

---

## 2. Audit — what's actually wrong (evidence)

Codebase: 337 JS files, ~61k lines (incl. ~20k of swagger docs). 41 mounted routers, 319
endpoints. Literal copy-paste is low (jscpd: 4.5% / 66 clones), so the problems are mainly
**structural**: too much in one place, the same pattern written by hand everywhere, and errors
handled ad hoc.

### 2.1 Bloaters — Long Method / Large Class

| Smell | Where | Size |
|---|---|---|
| Long Method | `controllers/user/payment.js` → `ipn` | **~1,087 lines** in a controller method |
| Large Class | `service/managerial/coupon.js` | 4,288 lines, ~60 methods, 6+ responsibilities (CRUD, targeting, redemption, click tracking, analytics, payment linking) |
| Large Class | `service/managerial/analyticsV2/analyticsV2Service.js` | 4,114 lines |
| Long Method | `service/user/payment.js` → `reconcilePayment` (427), `getPaymentHistoryAndEnrollments` (281) | |
| Long Method + Duplicate | `service/user/payment.js` → `initiatePayment` / `initiatePaymentForBundle` / `initiatePaymentForBook` | ~190 lines **each**, near-identical |
| Long Method | `courseImportExport.js` (one ~477-line method), `user.sendUserCredentials` (242), `admin.update` (187), `auth.requestOTP` / `resetPasswordWithOTP` (~150) | |

### 2.2 Couplers — Feature Envy / layer violation

- **Controllers that run SQL:** `controllers/managerial/course.js` (6 queries),
  `managerial/bundle.js` (2), `managerial/streakController.js`, `managerial/coupon.js`,
  `user/payment.js`. This breaks the documented Route → Controller → Service pattern.
- `controllers/user/payment.js` does business logic (coupon usage, bundle enrollment) with
  inline `require()`s **inside** the IPN handler (lines ~383, 405, 414, 773).
- `new SSLCommerzPayment(...)` built in 3 places, so there's no gateway abstraction.

### 2.3 Dispensables — Duplicate Code

- **Controller boilerplate:** ~215 hand-written `try/catch` blocks, 168 copies of
  `res.status(result.success ? 200 : 400).json(result)`, 165 `status(500)` branches. The V2
  controllers repeat a 15-line `ErrorHandler.createErrorResponse(...)` block per method.
- `service/authMiddleWares.js`: `requirePermission` / `requireAnyPermission` /
  `requireAllPermissions` repeat ~130 lines that differ only in the predicate.
- `coupon.js`: `addCoursesToCoupon` / `addBundlesToCoupon`, `removeCourses…` /
  `removeBundles…`, `getCouponCourses` / `getCouponBundles`, `getAvailableCourses` /
  `getAvailableBundles`, `validateCouponFor{Item,Bundle,Book}` are parallel copies per item type.
- `controllers/{user,managerial}/uploadV2.js` (42 duplicated lines);
  `controllers/managerial/{feedback,moduleFeedback}.js` (48).
- 13 services hand-roll `BEGIN / COMMIT / ROLLBACK / release()`, each with its own variant of the
  error path.
- Env lookups with fallbacks are copy-pasted: `JWT_EXPIRES_IN || '7d'` ×4,
  `FRONTEND_URL || 'https://mathpro.academy'` ×4, payment callback URL ×3.

### 2.4 Dispensables — Dead Code / Speculative Generality

| Item | Evidence |
|---|---|
| `Untitled-1` | 66-byte scratch note committed at repo root |
| `old_schema.sql`, `old_schema_neon.sql` (177 KB) | Not referenced by code; superseded by `database/migrations/` |
| `dev_stable.js` + `dev_stable` npm script | Loads `.env_stable`, which doesn't exist |
| `.ebextensions/` | AWS Elastic Beanstalk config; deploy target is now Coolify (confirm) |
| `util/canvas-polyfill/merge-images-polyfill.js` | Required by nothing |
| `app.js`: `const { user } = require("pg/lib/defaults")` | Unused import |
| `app.js`: `cors()` registered **twice** | Second call is a no-op override |
| `app.js`: `body-parser` | Built into Express 4.16+ (`express.json`) |
| Hardcoded AWS API-Gateway URL fallback in `service/user/payment.js` ×3 | Old host, same class as the bug fixed in `0a1f3ab` |
| `controllers/managerial/course.js:299` and other commented-out blocks | Commented-out code |
| `controllers/base.js` | Empty class; every controller extends it for nothing |
| 25 endpoints with **no reference in either client** (heuristic scan, list in §6 task D5) | Candidates only; need log or owner confirmation |

### 2.5 Error handling

1. **DB internals leak to clients (security).** `Service.query` returns `{success:false, error}`
   with the raw `pg` `Error`. Its enumerable fields (`code`, `detail`, `table`, `constraint`,
   `schema`, `routine`, …) are serialized by the 168 `res.json(result)` sites.
2. **Error codes instead of exceptions.** About 640 `return {success:false…}` sites in services
   versus 12 `throw`s. Every caller has to remember to check `success`, and a forgotten check
   turns into a `TypeError` later.
3. **Status codes are lost.** Services can't say "not found" or "forbidden", so most failures
   become 400. V2 (`util/errorHandler.js`) does map 404/422, so error shapes are inconsistent
   between V1 and V2.
4. **Process keeps running after `uncaughtException`** (`index.js`). The process stays up in an
   undefined state, which Node docs explicitly warn against.
5. Errors are logged inconsistently: `console.log(error)` vs `console.error('…', error)` vs
   swallowed. There's no request id on error logs, although `requestMetrics` already generates
   `x-request-id`.
6. Config errors (missing env) surface at request time, not boot. The prod outage on
   2026-06-30 (`DB_SSL`) was exactly this.

### 2.6 Change Preventers — Divergent Change / parallel hierarchies

- **V1 ⇄ V2 stacks** for course, teacher and module: `course.js` + `courseV2.js`,
  `teacher.js` + `teacherV2.js`, `module.js` + `moduleV2.js` (routes, controllers, services).
  `mathpro_admin` **still calls both** (`/admin/course/` 7 refs, `/v2/admin/course` 6,
  `/admin/teacher/` 6, `/admin/module/` 4, `/admin/chapter` 4). A behavior change today has to
  be made twice (Shotgun Surgery). Merging them is a cross-repo job, not a backend-only refactor.

---

## 3. Target architecture (end state)

```
config/index.js            single env reader, validated at boot (fail fast)
errors/AppError.js         AppError + NotFound/Validation/Forbidden/Conflict/Unauthorized
middleware/
  asyncHandler / respond   controller helper: result → status + envelope
  errorHandler.js          the ONLY place that turns errors into HTTP responses
  requestMetrics.js        (existing)
routes/      thin: path + auth middleware + controller method
controllers/ thin: read req → call service → respond(). No SQL, no business logic.
service/     business logic; throws AppError; transactions via withTransaction()
repositories/(optional, per hotspot) SQL for the large domains (coupon, payment)
integrations/sslcommerz.js gateway adapter (one construction site)
```

The response envelope **stays exactly as it is.** The new error middleware emits the same
`{success:false, error, message}` shape and the same status codes each route returns today.
For V2 routes it also keeps the existing `code` / `details` / `timestamp` fields.

---

## 4. Phases

| Phase | Goal | Risk | Client impact |
|---|---|---|---|
| **0** | Safety net: tests, real linter, CI | none | none |
| **1** | Dead code & config cleanup | low | none |
| **2** | Error-handling foundation | medium | none by design; one **CONTRACT** item (2.6) |
| **3** | Thin controllers & de-duplicated plumbing | medium | none |
| **R** | Reusability: shared building blocks (update builder, pagination, CRUD base, item registry, handler factory) | medium | none |
| **4** | Break up the god classes (payment, coupon, analytics) | **high** (money paths) | none |
| **5** | V1/V2 consolidation | high | **CONTRACT**, `mathpro_admin` |

Phases 0–1 must finish first. 2, 3 and R can interleave per feature (R5 needs 2.3). 4 needs the
payment characterization tests from 0.4 and builds on R1/R4/R7. 5 is a separate cross-repo project.

---

## 5. Decisions (answered 2026-10-10)

| # | Question | Decision |
|---|---|---|
| Q1 | Test DB | **Local DB.** Implemented as a private throwaway cluster (`initdb`, port 54329, data in `.testdb/`), not Docker (the user isn't in the `docker` group) and not the system Postgres on 5432 (that's the prod-tunnel port). |
| Q2 | Stop leaking `pg` error objects? | Yes (client check showed both read `error` as a string). |
| Q3 | Deployment leftovers (`.ebextensions/`, `dev_stable.js`, `old_schema*.sql`, `Untitled-1`) | **Not needed. Remove.** |
| Q4 | Client-unreferenced endpoints (D5) | **Archive them**: unmount and move the handler code to `archive/` (kept for reference, not loaded). |
| Q5 | V1→V2 merge | **Yes, do it now**, with the hard requirement that **both frontend repos keep working**; client changes are part of the same unit of work. |
| Q6 | Dev deps `eslint`, `supertest`, `jscpd` | Yes. |

---

## 6. Task list

Legend: **Smell → Technique** (refactoring.guru names) · Risk L/M/H · ✅ verify step.

### Phase 0 — Safety net (do first, no production code changes)

- [x] **0.1 Test harness.** Add `node:test` + `supertest` (dev deps), `npm test`, a
  `test/helpers/db.js` that starts Docker Postgres and applies migrations, and an `app` import
  that doesn't call `listen`. *Risk L.* ✅ `npm test` runs one `/ping` + one `/health` test.
- [x] **0.2 Real linter.** *(done: 10 errors fixed → 0; 45 `no-unused-vars` warnings remain, mostly unused params or results that need a behaviour look, see §7.)* ESLint flat config with `no-unused-vars`, `no-undef`,
  `no-unreachable`, `no-dupe-class-members`, `no-empty`, `eqeqeq` (warn). Keep
  `node -c` as `lint:syntax`. Baseline existing warnings; fail only on **new** ones. *Risk L.*
  ✅ the report lists the current unused imports and vars, which become the input for 1.6.
- [x] **0.3 Contract snapshot tests (characterization tests).** *(done as a full sweep: every mounted endpoint × {anon, student, admin}, 1,011 → 978 checks; also flags leaked connections, open transactions, unhandled rejections and timeouts.)* For each mounted router, at least
  one happy-path and one failure-path test that records **status code + envelope keys**
  (not volatile values). Start with the routes this plan touches: auth, payment, coupon,
  course, bundle, upload. *Risk L.* ✅ suite is green on the current `main`.
- [x] **0.4 Payment characterization tests.** Replay recorded SSLCommerz IPN / success / fail /
  cancel payloads for course, bundle and book (with and without coupon). Assert the DB side
  effects (`takes`, `payment`, coupon usage, bundle enrollment, book selection). Stub the
  SSLCommerz validation call. *Risk L, but essential for Phase 4.*
  Done: `test/payment/payment.test.js` (19 tests). SSLCommerz is faked at `https.request`
  (`test/helpers/sslcommerzStub.js`), so it covers both `sslcz.init` and the validation API and
  survives the 4.1 adapter. Mutation-checked (amount tolerance, coupon completion, book pricing).
  Two current behaviours are pinned as `CURRENT BEHAVIOUR` for Phase 4 to decide on: a replayed
  IPN while validation still says VALID is answered `success:false` and logged FAILED although
  the student is enrolled; and an IPN without `value_d`/`value_b` (incl. missing `status`) is
  never audited, because `payment_audit_log.item_type` is NOT NULL and the insert fails silently.
- [x] **0.5 CI.** GitHub Action: install → lint → test → jscpd report (non-blocking). *Risk L.*

### Phase 1 — Dead code & configuration (Dispensables)

- [x] **1.1 Delete repo junk.** `Untitled-1`, `old_schema.sql`, `old_schema_neon.sql`
  (*Dead Code → delete*). Needs Q3. *L.*
- [x] **1.2 Remove `dev_stable.js` + the `dev_stable` script**, and `.ebextensions/` if Q3 = yes. *L.*
- [x] **1.3 Delete `util/canvas-polyfill/`** (whole dir unused) + unused deps `jimp`, `jsrsasign`, `pdf-lib`, `crypto` (npm shim), `body-parser`, optional `canvas`/`merge-images`, and the `postinstall` echo. Was: delete `util/canvas-polyfill/merge-images-polyfill.js` after a final grep for
  dynamic `require` strings. *L.*
- [x] **1.4 `app.js` cleanup:** drop the unused `pg/lib/defaults` import, keep **one** `cors(...)`
  call with the effective config (`origin:"*"`; the second call wins today, so verify
  preflight headers are unchanged), replace `body-parser` with `express.json`/`urlencoded`
  (same 15 MB limits). Move the `require`s scattered mid-file to the top. *L.* ✅ 0.3 snapshot +
  a CORS preflight test.
- [ ] **1.5 Remove commented-out code blocks** (e.g. `controllers/managerial/course.js:299`).
  *Dead Code → delete.* *L.*
- [x] **1.6 Fix ESLint `no-unused-vars` findings** from 0.2 (unused imports, params, locals). *L.*
- [ ] **1.7 Introduce `config/index.js`.** *Smells: Duplicate Code, Magic literals →
  Extract Variable / Replace Magic Number with Symbolic Constant.* One module reads and
  validates env at boot: DB, JWT (`JWT_EXPIRES_IN` default once), `FRONTEND_URL`, `BACKEND_URL`,
  SSLCommerz, S3, SMS, quiz secrets. Missing required values → process exits at boot with a clear
  message. Replace the hardcoded AWS API-Gateway fallback with "required in production". *M:*
  confirm Coolify prod has every required var **before** deploying. ✅ boot test with a missing
  var fails fast; full suite green.
- [ ] **1.8 Remove the empty `Controller` base**, or give it meaning in 3.1 (*Lazy Class →
  Inline Class*). Decide together with 3.1; don't do both.

### Phase 2 — Error handling (Replace Error Code with Exception)

- [x] **2.1 `errors/AppError.js`.** `AppError(message, {status, code, details, expose})` +
  subclasses `ValidationError(400)`, `UnauthorizedError(401)`, `ForbiddenError(403)`,
  `NotFoundError(404)`, `ConflictError(409)`, `GoneError(410)`. *L.*
- [x] **2.2 Central error middleware** (`middleware/errorHandler.js`) replaces the inline one in
  `app.js`. `AppError` → its status + the **existing envelope**. Unknown errors → 500 with a
  generic message, full log with `x-request-id`. Never serialize raw errors. *M.* ✅ 0.3 green.
- [x] **2.3 `respond(res, result)` helper** *(Done in `controllers/base.js`: 185 sites in 30 controllers; the 5 non-standard ones (text reply, 403 mapping in testimonial) left as they are. Snapshot unchanged.)* (*Duplicate Code → Extract Method*), equivalent to
  `res.status(result.success ? 200 : 400).json(result)` but strips any non-plain `error`
  object. Mechanically replace the 168 sites. *M,* done per router, one PR per feature. ✅ 0.3 green.
- [x] **2.4 `withTransaction(fn)` on `Service`** *(Done: every hand-rolled transaction migrated: bundle ×3, chapter, module ×2, admin delete, courseV2 ×2, teacherV2, courseImportExport, moduleViews, moduleFeedback, streak, quizAttempt, featuredItem, coupon.recordUsage. Rolls back on throw **or** a `{success:false}` result; `begin` option keeps coupon's READ COMMITTED. Bugs fixed on the way: bundle delete/addCourses ran BEGIN/COMMIT through the pool (no real transaction, could strand an open transaction on a pooled connection); `bulkUpdateStreaks` held a useless second connection. coupon.recordUsage pinned by tests run against old and new code.)*
  `BEGIN` → `fn(client)` → `COMMIT`, `ROLLBACK` on throw, always `release()`. Migrate the 13
  services one at a time. *M.* ✅ a test asserts rollback on a thrown error and that no client leaks
  (`pool.totalCount` stays stable).
- [x] **2.5 `Service.queryOrThrow`** (new, alongside `query`). Throws `AppError` mapping known
  PG codes (`23505`→409, `23503`→400/409, `22P02`→400). New and refactored service code uses
  it; `query` stays for untouched code (*Strangler*, no big-bang change of 640 sites).
- [x] **2.6 CONTRACT (minor, client-safe): stop leaking `pg` errors.** *(Done: `errors/dbErrors.js` maps SQLSTATE → safe message; snapshot diff was exactly 20 entries `error: object → string`, nothing else.)* In `Service.query`, return
  `error: <safe message string>` and log the full error server-side.
  **Client check (done 2026-10-10):** the Frontend reads `response.data.error` /
  `.data.message` as display strings (~45 sites) and the Admin does the same (~4 sites);
  neither reads `.detail`, `.code` or `.constraint` off it. So a string is what both clients
  already expect, and today's serialized object probably renders as `[object Object]`.
  No client change needed. *M,* needs Q2.
- [x] **2.6b Status codes the clients branch on must survive the middleware.** Frontend:
  401, 403, 404, 429, 500. Admin: 400, 401, 403, 404, **409, 422**, 500. Add these to the 0.3
  snapshot tests before 2.2/2.8 land.
- [x] **2.7 Process-level handling** *(Coolify container verified `restart=unless-stopped`. Deviation: `unhandledRejection` is logged but NOT fatal, because fire-and-forget SMS/email promises would otherwise restart the process and drop in-flight requests; `uncaughtException` shuts down gracefully and exits 1.)* (`index.js`): on `uncaughtException` / `unhandledRejection`,
  log, then run the existing graceful `shutdown` and exit non-zero so Coolify restarts a clean
  process. Also close the pg pool in `shutdown`. *M:* verify Coolify restart policy first.
- [x] **2.8 Unify V1/V2 error shapes behind the middleware.** *(Done: ErrorHandler factories return AppErrors, `/v2`-scoped `v2Shape` keeps the V2 500 body; 114 hand-built sends → `throw`, 43 try/catch-500 wrappers removed from the 6 V2 controllers, net −360 lines; contract snapshot unchanged.)* `util/errorHandler.js` becomes
  a thin wrapper that throws `AppError`, so the V2 controllers lose their 15-line blocks.
  Output stays byte-identical (`code`, `timestamp`, `details`). *M.*
- [x] **2.9 Structured logging helper** *(Done: `util/logger.js` `logger.error(msg, err, context)` writes one JSON line; the request id comes from an AsyncLocalStorage context opened in `middleware/requestMetrics.js`, so service code logs it without `req`. 385 `console.error(msg, err)` / `console.log(e)` calls in 40 files converted. Left for Phase 4: the 20 multi-line, already-structured `console.error({...})` calls in the payment controller/service. Informational `console.log`/`warn` untouched.)*
  with request id. Replace bare `console.log(error)`. *L.*

### Phase 3 — Thin controllers & de-duplicated plumbing

- [x] **3.1 Controller boilerplate.** With 2.2 + 2.3 in place, remove the per-method
  `try/catch` that only maps to 500 (`express-promise-router` already forwards rejections).
  *Duplicate Code → Pull Up Method / Extract Method.* Do it one controller per PR, V2
  controllers first (heaviest boilerplate: `teacherV2`, `courseV2`, `moduleV2`, `featuredItem`,
  `uploadV2`). *M.*
  Done: V2 controllers in Phase 2; the other 151 methods (19 controllers) now use `catchAs(BODY, handler)` (`controllers/base.js`), which keeps each endpoint's own 500 body (clients show it), so no reply changed. Verified by AST comparison (old file + the one transform == new file).
- [x] **3.2 Move SQL out of controllers** (*Feature Envy → Move Method*):
  `managerial/course.js` (6 queries), `managerial/bundle.js` (2), `managerial/streakController.js`,
  `managerial/coupon.js:538`, `user/payment.js:387`. Each query becomes a named service method.
  *M.*
  Done: course (4 methods, the prebooking read was duplicated), bundle, streak, coupon, and the IPN coupon lookup; SQL text unchanged, `test/service/controllerQueries.test.js`. The other payment-controller queries move with the Phase 4 IPN rewrite.
- [x] **3.3 Auth middleware** (*Duplicate Code → Parameterize Method*): one
  `permissionGuard(predicate, requiredList)` factory backing `requirePermission`,
  `requireAnyPermission` and `requireAllPermissions`. Exports, error bodies and status codes
  stay identical. **Must not change JWT verify/claims** (invariant § Auth). *M.* ✅ dedicated tests
  for 401/403/allow on each guard, written **before** the change.
  Done: one `permissionGuard(deny)` behind requirePermission / Any / All / requireScopeAccess / requireCourseAccess (474 → 321 lines). Tests first: `test/middleware/permissionGuards.test.js` (25).
- [x] **3.4 Upload controllers** (*Duplicate Code → Extract Function*): shared helper for
  `controllers/{user,managerial}/uploadV2.js`. *L.*
  Done: `controllers/shared/presignedUpload.js`; `test/contract/uploadV2.test.js` passes on old and new code.
- [x] **3.5 Feedback controllers** (*Duplicate Code → Extract Function*): shared helper for
  `managerial/{feedback,moduleFeedback}.js`. *L.*
  Done: `controllers/shared/courseAccess.js` (`rejectCourseFilter`, `noCourseAccess`) + `util/csv.js`; `test/contract/feedbackCourseFilter.test.js` written first.
- [x] **3.6 Remaining intra-file clones** from the jscpd report (`moduleViews` controller/service,
  `analyticsController`, `CouponValidator`, `courseImportExport`, `routine`, `announcement`,
  `user/bundle`). *Extract Method*, one file per PR. *L.*
  Done, one commit per file, each with a test that passes on old and new code (or a differential check: CouponValidator 184,320 inputs, analyticsController 4,050 calls against a stubbed service). jscpd: 40 → 20 clones, 671 → 336 duplicated lines. Left (not on the list): `user/coupon` (fixed in 3.7), `courseV2`, `role`, `user`, `messagingService`, `roleService`, `testimonial`.
- [x] **3.7 Input validation** (*Long Method / Primitive Obsession → Introduce Parameter Object*):
  small `validate(schema)` helper (no new lib unless agreed) used by routes that hand-parse
  `req.body`. Must reproduce **current** messages and status codes; start with auth, payment,
  coupon. *M.*
  Done for auth (`middleware/validate.js`: `validate({ required, error })` on 9 routes, placed after the limiters) and coupon (`parseCouponRequest`). Payment's input checks live in the service and go with Phase 4 (4.2/R4). Pinned by `test/contract/inputValidation.test.js`.

### Phase R — Reusability: shared building blocks

The goal is to write each recurring concern **once**, as a small tested unit, and make new code
use it. Each block is introduced, then adopted file by file (Strangler); old call sites aren't
rewritten in bulk. Runs alongside Phases 3–4, and several Phase 4 tasks build on these blocks.
Shared code lives in `util/` (pure functions, no DB) or `service/shared/` (DB-aware). Record
the catalogue in `.claude/conventions.md` so future work reuses it instead of re-inventing it.

- [ ] **R1 `buildUpdate(table, pk, allowedCols, patch)`.** *Duplicate Code → Extract Function.*
  15 services hand-roll a dynamic `SET col=$n, …` builder (`admin`, `user`, `book`, `routine`,
  `testimonial`, `courseV2`, `moduleV2`, `teacherV2`, `coupon`, `roleService`, `feedback`,
  `moduleFeedback`, `courseImportExport`, `payment`, …). One whitelist-based helper also closes a
  class of SQL-injection risk from un-whitelisted column names. *M.* ✅ unit tests for whitelist,
  empty patch and `null` values.
- [ ] **R2 Pagination.** `parsePagination(query, {defaultLimit, maxLimit})` +
  `paginatedQuery(service, sql, params, page)` that returns the shape each endpoint already uses.
  Replaces 26 hand-parsed `req.query.page/limit` sites and 16 `LIMIT/OFFSET` builders.
  *Duplicate Code → Extract Function.* Response keys **must** match per endpoint (some say
  `total`, some `totalCount`), so the helper returns raw numbers and the caller keeps its envelope. *L.*
- [ ] **R3 `BaseCrudService`** (*Duplicate Code → Pull Up Method / Form Template Method*).
  `Service` subclasses already declare `table`, `pk` and `cols`, but nothing uses them. A
  `CrudService` with `findById`, `list`, `create`, `update` (via R1) and `remove`, with hooks
  for ordering and scoping. Adopt in the small, near-identical services first: `faq`,
  `announcement`, `routine`, `book`, `chapter`, `featuredItem` (~1,100 lines today). *M.*
- [ ] **R4 Purchasable item registry** (*Switch Statements / Parallel Inheritance →
  Replace Conditional with Polymorphism*). One `itemTypes` registry describing course, bundle
  and book: price lookup, existence check, enrollment/fulfillment, coupon link table, display
  name. Payment (4.2/4.3), coupon (4.5) and feedback use it instead of `if itemType === …`
  branches and the triplicated `…ForBundle` / `…ForBook` methods. Adding a fourth item type
  then means one registry entry, not edits across 3 god classes. *H,* do it together with 4.2.
- [ ] **R5 Controller handler factory** (*Duplicate Code → Extract Function*, builds on 2.3).
  `handle(serviceCall)` / `handle((req) => service.x(req.params.id, req.body))` produces a
  standard Express handler (call → `respond`), so trivial controller methods become one line.
  Hand-written methods stay only where there's real request translation. *L.*
- [ ] **R6 Access-control helpers.** Consolidate course-scope checks spread across controllers
  (`getAccessibleCourseIds` / `checkCourseAccess` from `util/courseAccessHelpers.js`, plus
  inline variants) behind `requireCourseAccess` middleware or one service call. *M,* touches
  auth, so tests first (3.3).
- [ ] **R7 Analytics query kit.** `parseDateRange(query)` + shared filter/WHERE builders for
  the date-range and filter parsing repeated across `coupon` analytics, `analyticsV2Service`,
  `revenueService` and `feedback` stats. Prerequisite for splitting analytics in 4.6. *M.*
- [ ] **R8 Document the catalogue.** Add a "Shared building blocks" section to
  `.claude/conventions.md` (what exists and when to use it) so new code stops duplicating. *L.*

### Phase 4 — Break up the god classes (highest value, highest risk)

Requires 0.4 green. Each step is a separate PR and deploy, watched in prod.

- [ ] **4.1 SSLCommerz adapter** (*Extract Class*): `integrations/sslcommerz.js` owns
  construction, `init`, `validate` and sandbox flag. Replaces the 3 `new SSLCommerzPayment`
  sites and `validateTransactionWithSSLCommerz`. *M.*
- [ ] **4.2 `initiatePayment*` ×3 → one flow** (*Duplicate Code → Form Template Method*):
  a shared `initiateCheckout(itemStrategy, body)` where each strategy (course / bundle / book)
  supplies `loadItem`, `price`, `couponValidator`, `productInfo`. The three public methods remain
  as one-line delegators, so the controller and routes don't change. *H.* ✅ 0.4.
- [ ] **4.3 IPN handler, ~1,087 lines** (*Long Method → Extract Method → Move Method →
  Replace Conditional with Polymorphism*):
  1. Extract Method in place: `parseIpn`, `verifyWithGateway`, `markPaid`, `applyCoupon`,
     `enroll`, `notify` (no behavior change, still in the controller).
  2. Move Method into a new `service/user/paymentFulfillment.js`; hoist the inline `require`s.
  3. Replace the course/bundle/book branching with fulfillment strategies (shared with 4.2).
  4. Wrap the DB side-effects in `withTransaction` (*bug-fix commit, separate*; today a failure
     mid-way can leave partial state, see §7).
  *H.* ✅ 0.4 after every sub-step. Deploy each sub-step separately.
- [ ] **4.4 `reconcilePayment` / `getPaymentHistoryAndEnrollments`** (*Extract Method*,
  *Decompose Conditional*). *M.*
- [ ] **4.5 `CouponService`, 4,288 lines** (*Large Class → Extract Class*, keep a **Facade**):
  - `CouponCrudService` (create/get/update/delete/list)
  - `CouponTargetingService` (courses/bundles/books links: **Parameterize Method** merges
    `add/remove/get/getAvailable{Courses,Bundles}` into `…Targets(itemType, …)`)
  - `CouponRedemptionService` (validate/apply/recordUsage/payment-coupon data; merges
    `validateCouponFor{Item,Bundle,Book}` and `applyCouponToPrice*`, which already half-use
    `applyCouponToPriceForItem`)
  - `CouponClickTrackingService`, `CouponAnalyticsService`
  - `CouponService` stays as the exported facade delegating to these, so no caller or controller
    changes in this phase. *H.* ✅ 0.3 coupon tests + 0.4.
- [ ] **4.6 `analyticsV2Service`, 4,114 lines** (*Extract Class* by dashboard domain: revenue,
  enrollment, engagement, coupon, …), with a facade as in 4.5. *M* (read-only queries).
- [ ] **4.7 Other long methods:** `courseImportExport` (~477-line method → *Extract Method* per
  entity), `user.sendUserCredentials`, `admin.update`/`create`, `auth.requestOTP` /
  `resetPasswordWithOTP` (*Decompose Conditional*; auth tests from 3.3 first). *M.*

### Phase 5 — V1/V2 consolidation (cross-repo, **CONTRACT**, separate project)

- [ ] **5.1 Inventory** every V1 call in `mathpro_admin` and map each to a V2 equivalent or
  a gap. Current V1 calls found in the admin repo:
  - chapter: `create`, `get`, `update`, `delete` (no V2 chapter API exists, so this is a **gap**)
  - module: `create`, `get`, `update`, `delete` (V2 module exists)
  - teacher: `create`, `get`, `list`, `update`, `delete`, `reset-password` (V2 teacher exists;
    `useTeachers.ts` already special-cases string errors)
  - course: `getAllCoursePerchasesApi`, `getAllPendingCertificates`, `getAllPrebookingsApi`,
    `getAllRevenue`, `getUserProgress`, `issueCertificate`, plus `getRevenue/:id` and
    `prebooking/:id/utm` (reporting/certificates, mostly **no V2 equivalent**)
  `MathPro_Frontend` calls none of the V1 admin routes.
- [ ] **5.2 Strangler step:** reimplement V1 handlers as thin adapters over V2 services (same
  V1 request/response shapes) so the business logic lives in one place. Backend-only, no client change.
- [ ] **5.3 Migrate `mathpro_admin`** to V2 endpoints (admin repo work, same unit of work).
- [ ] **5.4 Deprecate V1** with the existing `410 ENDPOINT_DEPRECATED` pattern once logs show
  zero traffic, then delete V1 routes/controllers/services. Update swagger + docs.
- [x] **D5 Unreferenced endpoints** (needs Q4). Cross-checked against both client repos,
  including dynamically built URLs. These have **no caller in `MathPro_Frontend` or
  `mathpro_admin`**:
  `POST /user/course/takes/:id`, `GET /user/course/getScore/:id`,
  `POST /user/course/prebookBundle/:id`, `GET /user/course/getWishList`,
  `GET /user/course/getMyCourses`, `GET /user/course/getMyCoursesPage`,
  `GET|DELETE /user/module/recentViews/:courseId`, `GET /user/coupon/check-applicability`,
  `POST /user/notification/bellIconClicked` (made obsolete by the 2026-06-19 unread-count change),
  `GET /user/feedback/course/:courseId/average`.
  First add a `deprecated-hit` log line to each, wait two weeks, then switch to `410` → delete.
  **Keep (not dead):** `/user/payment/{ipn,failure,redirect/:status,redirectNew}` (SSLCommerz
  callbacks), `POST /admin/auth/link-phone` (pending phone-auth FE work, memory 2026-06-18).
  The first, naive scan also flagged `getRevenue`, `prebooking/:id/utm`, `batch-update`,
  `bulk-assign-course`, `coupon-clicks`, `my-bundles`, streak `leaderboard`/`manual-update`/
  `bulk-update`, and `logout`. **All are used by `mathpro_admin`**, so they stay.

---

## 7. Bugs and risks spotted during the audit (fix separately, not inside refactor commits)

0. **CRITICAL, live in production, REMOVED on this branch (D5): free enrollment.** `POST /user/course/takes/:id`
   (`authenticateUser` only) calls `courseService.takes(user_id, course_id)` directly, the same
   insert the payment flow uses, with no payment or `is_free` check. `takes.amount` and
   `transaction_id` are nullable, so any logged-in student can enroll in any paid course.
   Reproduced in the test sweep (`200 success`). Neither client calls it. **Fix: unmount the
   route as a standalone hotfix on `main`, deploy, then audit prod `takes` rows with
   `transaction_id IS NULL AND amount IS NULL` that aren't free courses / admin grants.**
0b. **CRITICAL, FIXED on this branch: connection-pool poisoning (prod since 2026-06-29,
   commit `53936a8`).** `Service.getClient()` replaced `client.query` on the pooled client with a
   timing wrapper that dropped pg's callback argument. `pool.query()` later reuses that client
   with a callback, so **after any transaction the next request on that connection hung forever
   and the connection was never returned**. Each transaction (13 services) costs one hung
   request + one leaked connection; once all 30 are gone, every DB route hangs until restart.
   This likely explains the 2026-06-30 outage and any "random 502s since". Fixed in
   `service/base.js` + regression test `test/service/base.test.js`. **Ship as a hotfix.**
0c. `000_base_schema.sql` can't bootstrap an empty DB (stray `(` near line 1304). Not editable
   without breaking the checksum recorded in prod `schema_migrations`; the test harness repairs it
   in memory. Proper fix: a checksum-update procedure in `runMigration.js`, applied deliberately.

1. `pg` error objects (schema/table/constraint details) are serialized to API clients → 2.6.
2. `uncaughtException` is swallowed and the process keeps running → 2.7.
3. IPN fulfillment touches several tables without one transaction, so partial state is
   possible on failure → 4.3 step 4.
4. Hardcoded stale AWS API-Gateway callback URL used if `BACKEND_URL`/`PRODUCTION_URL` are unset,
   so payment callbacks would go to a dead host → 1.7.
5. Duplicate `cors()` registration; the effective config is the second one → 1.4.
6. Dynamic `SET ${col}` builders in 15 services: any that don't whitelist column names are
   an injection risk → R1 (audit each while adopting).
7. `service/managerial/course.js` (~line 333, module re-serial update): the query result is
   ignored and the method always returns `success: true`, so a failed DB update reports success.
8. `CouponAuditLogger` builds every audit entry and never writes it (logging was disabled).
   Coupon audit trail is effectively off → task 2.9.
9. Several `catch {}` blocks swallow errors silently (e.g. prebook confirmation email) → 2.9.

---

## 8. Definition of done (per task and overall)

- Tests green (incl. 0.3 contract snapshots and 0.4 payment replay); `npm run lint` clean;
  no new ESLint warnings; jscpd duplication not higher than before.
- No route path, status code, envelope key, JWT claim or DB column changed unless the task is
  tagged **CONTRACT** and the listed client work is done in the same unit.
- `swagger/` + `docs/` updated if a documented route was touched; `.claude/memory.md` appended.
- Overall targets: no controller method > 40 lines, no service file > 1,000 lines, zero SQL in
  controllers, zero raw-error serialization, one transaction helper, one config module,
  duplication < 2%.
- Reusability targets: zero hand-rolled dynamic `UPDATE … SET` builders outside R1, zero
  hand-parsed pagination outside R2, zero `itemType === 'course'|'bundle'|'book'` branches
  outside the R4 registry, and the shared-block catalogue documented in `conventions.md`.
