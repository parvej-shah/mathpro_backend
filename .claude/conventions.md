# Conventions — Naming, API Patterns, Coding Standards

Default patterns for this codebase. Follow them unless an `invariants.md` law or a feature
`rules.md` says otherwise. These describe *how* the code is written; `invariants.md`
describes what must *never* change.

## Project layout

```
index.js / app.js        Express app + server bootstrap (dev.js / dev_stable.js for dev)
routes/
  contact.js              Root-level routes
  in/                      Unauthenticated/integration — auth.js, item.js
  user/                    Student/public — course.js, bundle.js, payment.js, profile.js, …
  managerial/              Admin/content-creator — course.js, bundle.js, role.js, user.js, …
controllers/               Mirrors routes/ exactly — same subdirs/filenames
service/
  authMiddleWares.js, base.js, …  Root-level shared services
  in/, user/, managerial/   Mirrors routes/ — owns DB queries + business logic
database/
  migrations/               000_base_schema.sql … sequential numbered SQL files
  runMigration.js           Migration runner
util/
  authHelpers.js, constants.js, permissions.js, courseAccessHelpers.js,
  errorHandler.js, presignedUploadService.js, rateLimiter.js, uploadPolicies.js
docs/                       API specs + frontend integration guides (see AGENTS.md)
swagger/user.yaml           OpenAPI spec — the contract reference
```

## Route -> Controller -> Service pattern

1. **Route** (`routes/<area>/<feature>.js`) — `express-promise-router`, instantiates a
   controller, wires HTTP verbs/paths, applies auth middleware:
   ```javascript
   const router = require("express-promise-router")();
   const CourseController = require('../../controllers/user/course').CourseController;
   const courseController = new CourseController();
   router.route("/list").get(courseController.list);
   ```

2. **Controller** (`controllers/<area>/<feature>.js`) — extends `Controller` (base.js),
   instantiates service(s), translates service result to HTTP response:
   ```javascript
   const Controller = require("../base").Controller;
   const CourseService = require("../../service/managerial/course").CourseService;
   const courseService = new CourseService();
   class CourseController extends Controller {
       list = async (req, res) => {
           const result = await courseService.listForUser(req);
           return res.status(result.success ? 200 : 400).json(result);
       };
   }
   ```

3. **Service** (`service/<area>/<feature>.js`) — extends `Service` (base.js), owns table
   name, columns, and all DB queries via `this.query(sql, params)`:
   ```javascript
   const Service = require("../base").Service;
   class CourseService extends Service {
       table = `course`;
       pk = `id`;
       cols = [`title`, `price`, ...];
       listForUser = async (req) => { /* DB query logic */ };
   }
   ```

- Export pattern: named export `{ ClassName }`.
- `user/` = student/public-facing; `managerial/` = admin/content-creator. A feature usually
  has both (e.g. `user/course.js` for students, `managerial/course.js` for admin CRUD).
- `Service.query(sql, params)` returns `{ success, data, rowCount, error }`.
  `Service.getClient()` for explicit transaction management.

## Naming

- File names match the feature domain (`course.js`, `bundle.js`, `role.js`, `payment.js`)
  and mirror across `routes/`, `controllers/`, `service/`.
- `V2`/`courseV2.js`-style suffixes mark versioned re-implementations alongside the
  original — don't delete the original when adding a V2 unless told to.

## Auth

- Legacy type-based middleware (`authenticateAdmin`, `authenticateUser`,
  `optAuthenticateUser`, `authenticateInv`) checks `type` (1=admin, 2=moderator,
  3=regular) — still active on older routes.
- RBAC middleware (`authenticate`, `requirePermission`, `requireAnyPermission`,
  `requireAllPermissions`, `requireScopeAccess`, `requireCourseAccess`) checks permission
  strings from `util/permissions.js` (`resource.action.all` pattern, e.g.
  `user.manage.all`). New admin routes should use RBAC middleware, not the legacy
  type-based checks, unless matching an existing route's pattern.
- Both live in `service/authMiddleWares.js`.

## API response shape

- Success: `{ success: true, data: {...}, message?: "..." }`
- Error: `{ success: false, error: "...", message?: "..." }`
- Permission error adds `error: "INSUFFICIENT_PERMISSIONS"` (or similar code) and
  `required: [...]`.
- Status codes: 200 success, 400 client/validation error, 401 unauthenticated,
  403 invalid/expired token or insufficient permissions, 410 deprecated endpoint,
  500 server error. Controllers map `result.success` to 200/400 — don't invent new codes
  without checking `docs/`.

## Database

- Migrations are numbered SQL files in `database/migrations/`, run via
  `database/runMigration.js`. New schema changes get the next sequential number.

## Verification

- `npm run lint` — syntax check only (`node -c app.js && node -c index.js`).
- `npm run dev` (nodemon → `dev.js`) for local dev, port 8000 (`PORT` env, default 8000).
- `npm start` (`node index.js`) for production-mode run.
- Keep `swagger/user.yaml` and the relevant `docs/*.md` in sync with route changes.
