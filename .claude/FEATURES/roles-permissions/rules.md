# Feature: roles-permissions — Rules & Guardrails

Inherits all of `invariants.md` and `conventions.md`. Invariants always win.

## Permission strings

- `util/permissions.js` (`PERMISSIONS`) is the single source of truth. Adding a new
  permission means: add it to `PERMISSIONS`, apply it via `requirePermission` /
  `requireAnyPermission` / etc. on the relevant route(s), and update
  `docs/admin_api_permission_mapping.md` (consumed by `mathpro_admin`) — this is a
  cross-repo contract change, flag it.
- Never check a raw permission string literal in a route/controller that isn't defined in
  `PERMISSIONS` — typos here silently fail closed (deny) or fail open depending on the
  middleware, both are bugs.

## Super admin

- `super_admin` (`SUPER_ADMIN_ROLE_NAME`) must stay non-deletable and non-modifiable in
  `roleService.js` (`deleteRole`, `updateRole`, `checkRoleOwnership`) — this guarantee is
  load-bearing for `mathpro_admin`'s `RoleTable`/`DeleteRoleDialog`, which assume the
  server rejects such requests. Don't remove the server-side check even if a client adds
  its own guard.

## JWT claims

- `roles` and `permissions` are embedded in the JWT at login/token-issue time
  (`service/managerial/auth.js`, `service/user/...auth`). Changing what's embedded, or the
  shape of a role/permission entry, changes what **both clients** can decode — coordinate
  with `mathpro_admin`'s `lib/auth.ts` / `AuthContext` and `MathPro_Frontend`'s auth
  context.
- A role/permission change takes effect on a user's **next** token issuance (login or
  refresh), not retroactively on an existing token — don't imply live revocation unless
  the middleware actually re-checks against the DB per-request.

## Legacy vs RBAC

- `managerialAccountTypes` (admin=1/moderator=2/regular=3) is the legacy type-based system,
  still checked by `authenticateAdmin`/`authenticateUser` on older routes. New routes
  should use RBAC (`requirePermission` etc.) per `conventions.md` § Auth — don't add new
  routes gated only by legacy `type` unless matching an existing route's pattern.
