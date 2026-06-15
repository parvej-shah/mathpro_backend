# Feature: roles-permissions — Purpose

## Domain

Owns the RBAC contract: role/permission CRUD, user-role assignment, and the permission
strings both clients use to gate UI. This repo **issues** the JWT containing `roles` and
`permissions` claims that `mathpro_admin` and (to a lesser extent) `MathPro_Frontend`
decode and act on.

## Routes / Controllers / Services

**Admin** (`routes/managerial/role.js`):
- `GET /admin/roles/permissions` — list of all valid permissions (no auth middleware,
  returns the full catalog).
- `GET /admin/roles/` — list roles (`role.manage.all`).
- `POST /admin/roles/`, `GET/PUT/DELETE /admin/roles/:id` — role CRUD.
- `GET /admin/roles/users/:userId/roles`, `POST .../roles`,
  `DELETE .../roles/:roleId` — assign/remove roles on a user.
- `GET /admin/roles/users/:userId/permissions` — effective permissions computed from all
  assigned roles.

**Controller:** `controllers/managerial/role.js` (`RoleController`) — `listRoles`,
`createRole`, `getRole`, `updateRole`, `deleteRole`, `getUserRoles`, `assignRole`,
`removeRole`, `getUserPermissions`, `getPermissionsList`.

**Service:** `service/managerial/roleService.js` (`RoleService`) — manages `roles` and
`user_roles` tables. `roles`: `id, name, display_name, description, permissions (json
array), created_at, updated_by`. `user_roles`: `user_id, role_id, created_at, updated_by`.
Methods: `getUserRoles`, `assignRole`, `removeRole`, `getUserPermissions`, `listRoles`,
`createRole`, `updateRole`, `deleteRole`, `checkRoleOwnership`, `validatePermissions`.

**Utilities:**
- `util/permissions.js` — `PERMISSIONS` object, the single source of truth for valid
  permission strings (`resource.action.all` pattern, e.g. `PERMISSIONS.USER.MANAGE.ALL =
  'user.manage.all'`). `isValidPermission()`, `validatePermissions()`,
  `getAssignablePermissions()`.
- `util/constants.js` — `SUPER_ADMIN_ROLE_NAME = 'super_admin'`, legacy
  `managerialAccountTypes` (`admin: 1, moderator: 2, regular: 3`).

## Reference docs

- `docs/ROLE_MANAGEMENT_API_FRONTEND.md` — full API + permission format.
- `docs/JWT_TOKEN_SYSTEM_FRONTEND.md` — how `roles`/`permissions` appear in the JWT.
- `docs/frontend-guide-admin.md` — admin panel integration.
