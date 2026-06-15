# Role Management API — Frontend Developer Guide

This document describes the **Role Management** APIs for the admin panel. Use it to integrate role CRUD, user–role assignment, and permission listing in your frontend.

---

## Overview

The Role Management API allows:

- Listing and managing **roles** (create, read, update, delete).
- **Assigning** and **removing** roles for a given user.
- **Reading** a user’s roles and their **aggregated permissions**.
- **Fetching the list of valid permissions** the backend accepts (for the role create/edit form).

All endpoints are for **managerial (admin) users** only. When the backend enforces permission-based access, the caller must have the **`role.manage.all`** permission.

**Setting permissions for a role:** When the admin creates or edits a role, the frontend must show a list of permissions (e.g. checkboxes or multi-select). That list must match exactly what the backend accepts. To avoid duplication and keep in sync, the frontend should **fetch the permission list from the API** (see **Get list of permissions** below) when loading the role create/edit screen, and use that response to render the options. Do not hardcode the permission list on the frontend.

---

## Base URL and authentication

- **Base path:** `/admin/roles`
- **Full base URL:** `{API_BASE_URL}/admin/roles` (e.g. `https://api.example.com/admin/roles`)

**Authentication:** Every request must include a valid admin JWT in the `Authorization` header:

- Header: `Authorization: Bearer <token>`
- The token must belong to a managerial account (admin/moderator type). When permission checks are enabled, the token must also include the permission **`role.manage.all`** in its `permissions` array (or via assigned roles).

---

## Permissions

| Requirement | Description |
|-------------|-------------|
| **Auth** | Valid admin JWT (managerial account). |
| **Permission** | `role.manage.all` — required for all Role Management endpoints when the backend uses permission-based authorization. |

If the user is not authenticated or the token is invalid, the API returns **401**. If the user is authenticated but not allowed (e.g. not admin type or missing `role.manage.all`), the API returns **403** with an error code such as `INSUFFICIENT_PERMISSIONS`.

---

## Common response and error format

**Success responses** typically look like:

- `success`: `true`
- `data`: payload (object or array)
- Optional: `message`, `count`

**Error responses** typically look like:

- `success`: `false`
- `message`: human-readable message
- `error`: machine-readable code (e.g. `INVALID_ID`, `NOT_FOUND`)

**HTTP status codes:**

- **200** — Success (GET, PUT, DELETE, or POST for assign).
- **201** — Created (POST create role).
- **400** — Bad request (validation, business rule, or “not found” where the API uses 400).
- **401** — Unauthorized (missing or invalid token).
- **403** — Forbidden (not admin or missing `role.manage.all`).
- **404** — Not found (e.g. role by ID).
- **500** — Server error.

---

## Endpoints

---

### 1. Get list of permissions

**GET** `/admin/roles/permissions`

**Description:** Returns the list of assignable permissions: **only `resource.manage.all`** permissions (e.g. `user.manage.all`, `course.manage.all`, `role.manage.all`). Use this when building the **Create role** or **Edit role** form so the frontend shows the same list the backend accepts (no need to maintain a separate list on the frontend).

**Request:**

- No path or query parameters.
- Headers: `Authorization: Bearer <token>`.

**Success response (200):**

- `success`: `true`
- `data`: object with two shapes of the same permission list (only **resource.manage.all** permissions):
  - **`data.all`** — Array of assignable permission strings (e.g. `["user.manage.all", "course.manage.all", "role.manage.all", ...]`). Same permissions as in `by_resource`, but in one flat list. Use this when you want a single list (e.g. one set of checkboxes). The frontend should only send permission strings from this array when creating or updating a role.
  - **`data.by_resource`** — Object keyed by resource name in UPPERCASE (e.g. `USER`, `COURSE`, `ROLE`). Each key’s value is an array with that resource’s manage.all permission only (e.g. `by_resource.USER` is `["user.manage.all"]`). Use this to show permissions in sections (e.g. “User”, “Course”, “Role”). When submitting the form, collect all selected strings from every section into one array and send as `permissions`.
- `count`: Number; total number of permissions (e.g. 25). Always equals `data.all.length`. Use for “X of N selected” or to confirm the list loaded.

**How to use the response:**

- **Single list UI:** Use `data.all`. Render one checkbox (or multi-select option) per item. On submit, send the checked/selected strings as the `permissions` array in the role create/update body.
- **Grouped UI:** Use `data.by_resource`. Loop over `Object.entries(data.by_resource)` and render one section per resource (e.g. heading “User”, then checkboxes for that resource’s permissions). On submit, merge all checked permission strings from every section into one array and send as `permissions`.
- **When to call:** On opening the Create role or Edit role screen. Optionally cache the response (e.g. in state or a store) and reuse for every form open so the list stays in sync with the backend without refetching every time.
- **Edit role:** When loading an existing role, pre-check the checkboxes whose permission string is in the role’s `permissions` array (from GET role or list response).

**Errors:**

- **401** — Missing or invalid token.
- **403** — Forbidden (e.g. not admin or missing `role.manage.all`).
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 2. List all roles

**GET** `/admin/roles`

**Description:** Returns all roles in the system (id, name, display_name, description, permissions, created_at, updated_at).

**Request:**

- No path or query parameters.
- Headers: `Authorization: Bearer <token>`, `Content-Type: application/json` (optional for GET).

**Success response (200):**

- `success`: `true`
- `data`: array of role objects
- `count`: number of roles

Each role object includes: `id`, `name`, `display_name`, `description`, `permissions` (array of strings), `created_at`, `updated_at`.

**Errors:**

- **400** — Failed to fetch roles (e.g. `message`, `error` from server).
- **401** — Missing or invalid token.
- **403** — Not allowed (e.g. not admin or missing `role.manage.all`).
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 3. Get a single role

**GET** `/admin/roles/:id`

**Description:** Returns one role by ID.

**Request:**

- **Path:** `id` — role ID (integer).

**Success response (200):**

- `success`: `true`
- `data`: single role object (`id`, `name`, `display_name`, `description`, `permissions`, `created_at`, `updated_at`).

**Errors:**

- **400** — Invalid role ID (e.g. non-numeric or missing). `error`: `INVALID_ID`.
- **404** — Role not found. `error`: `NOT_FOUND`.
- **401** — Unauthorized.
- **403** — Forbidden.
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 4. Create a new role

**POST** `/admin/roles`

**Description:** Creates a new role. `name` must be unique; it is stored in lowercase.

**Request body (JSON):**

- **name** (required) — string; unique identifier; stored lowercase.
- **display_name** (required) — string; label shown in UI.
- **description** (optional) — string or null.
- **permissions** (optional) — array of permission strings (e.g. `["user.manage.all", "course.manage.all"]`). Must be valid permissions known to the backend; invalid entries cause validation failure.

**Success response (201):**

- `success`: `true`
- `message`: e.g. "Role created successfully"
- `data`: created role object (`id`, `name`, `display_name`, `description`, `permissions`, `created_at`).

**Errors:**

- **400** — Validation or business rule failure:
  - Missing `name` or `display_name`: `error`: `MISSING_FIELDS`.
  - `permissions` not an array: `error`: `INVALID_PERMISSIONS`.
  - Role name already exists: `error`: `CREATE_FAILED`, `message` e.g. "Role name already exists".
  - Invalid permission strings: `error`: `CREATE_FAILED`, `message` lists invalid permissions.
- **401** — Unauthorized.
- **403** — Forbidden.
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 5. Update a role

**PUT** `/admin/roles/:id`

**Description:** Updates an existing role. Send only the fields you want to change.

**Request:**

- **Path:** `id` — role ID (integer).
- **Body (JSON):** at least one of:
  - **name** — string (stored lowercase).
  - **display_name** — string.
  - **description** — string or null.
  - **permissions** — array of permission strings.

**Success response (200):**

- `success`: `true`
- `message`: e.g. "Role updated successfully"
- `data`: updated role object (e.g. `id`, `name`, `display_name`, `description`, `permissions`, `updated_at`).

**Errors:**

- **400** — Validation or business rule failure:
  - Invalid role ID: `error`: `INVALID_ID`.
  - No fields sent: `error`: `NO_UPDATE_FIELDS`.
  - `permissions` not an array: `error`: `INVALID_PERMISSIONS`.
  - Role not found or update failed: `error`: `UPDATE_FAILED`.
  - Invalid permission strings: `message` lists invalid permissions.
- **401** — Unauthorized.
- **403** — Forbidden.
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 6. Delete a role

**DELETE** `/admin/roles/:id`

**Description:** Deletes a role. System roles cannot be deleted. Roles that are assigned to any user cannot be deleted.

**Request:**

- **Path:** `id` — role ID (integer).

**Success response (200):**

- `success`: `true`
- `message`: e.g. "Role deleted successfully"
- No `data` in response.

**Errors:**

- **400** — Validation or business rule failure:
  - Invalid role ID: `error`: `INVALID_ID`.
  - Role not found: `error`: `DELETE_FAILED`.
  - System role (e.g. `admin`, `moderator`, `student`, `teacher`): `error`: `DELETE_FAILED`, `message`: "Cannot delete system roles".
  - Role is assigned to one or more users: `error`: `DELETE_FAILED`, `message`: "Cannot delete role that is assigned to users".
- **401** — Unauthorized.
- **403** — Forbidden.
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 7. Get a user’s roles

**GET** `/admin/roles/users/:userId/roles`

**Description:** Returns all roles currently assigned to the given user. Each item can include role details and assignment metadata (e.g. `assigned_at`, `updated_by`).

**Request:**

- **Path:** `userId` — managerial/user ID (integer).

**Success response (200):**

- `success`: `true`
- `data`: array of role/assignment objects (e.g. `id`, `name`, `display_name`, `description`, `permissions`, `assigned_at`, `updated_by`).
- `count`: number of roles.

**Errors:**

- **400** — Invalid user ID or fetch failure. `error`: `INVALID_USER_ID` or server message.
- **401** — Unauthorized.
- **403** — Forbidden.
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 8. Assign a role to a user

**POST** `/admin/roles/users/:userId/roles`

**Description:** Assigns a role to a user. The same role cannot be assigned twice to the same user.

**Request:**

- **Path:** `userId` — user ID (integer).
- **Body (JSON):**
  - **role_id** (required) — integer; ID of the role to assign.

**Success response (200):**

- `success`: `true`
- `message`: e.g. "Role assigned successfully"
- `data`: assignment record (e.g. `id`, `user_id`, `role_id`, `created_at`, `updated_by`) and may include `role` (role object).

**Errors:**

- **400** — Validation or business rule failure:
  - Invalid `userId`: `error`: `INVALID_USER_ID`.
  - Invalid or missing `role_id`: `error`: `INVALID_ROLE_ID`.
  - Role not found: `error`: `ASSIGN_FAILED`, `message`: "Role not found".
  - User already has this role: `error`: `ASSIGN_FAILED`, `message`: "User already has this role".
- **401** — Unauthorized.
- **403** — Forbidden.
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 9. Remove a role from a user

**DELETE** `/admin/roles/users/:userId/roles/:roleId`

**Description:** Removes a role assignment from a user. The user must currently have that role.

**Request:**

- **Path:** `userId` — user ID (integer).
- **Path:** `roleId` — role ID (integer).

**Success response (200):**

- `success`: `true`
- `message`: e.g. "Role removed successfully"
- `data`: may include removal details (e.g. `id`, `user_id`, `role_id`, `removed_by`).

**Errors:**

- **400** — Validation or business rule failure:
  - Invalid `userId`: `error`: `INVALID_USER_ID`.
  - Invalid `roleId`: `error`: `INVALID_ROLE_ID`.
  - User does not have this role: `error`: `REMOVE_FAILED`, `message`: "User does not have this role".
- **401** — Unauthorized.
- **403** — Forbidden.
- **500** — Server error (`error`: `SERVER_ERROR`).

---

### 10. Get a user’s permissions

**GET** `/admin/roles/users/:userId/permissions`

**Description:** Returns the aggregated list of permission strings for the user (from all their assigned roles). Useful for showing “what this user can do” or for driving UI visibility.

**Request:**

- **Path:** `userId` — user ID (integer).

**Success response (200):**

- `success`: `true`
- `data`: array of permission strings (e.g. `["user.manage.all", "course.manage.all"]`).
- `count`: number of permissions.

**Errors:**

- **400** — Invalid user ID or fetch failure. `error`: `INVALID_USER_ID` or server message.
- **401** — Unauthorized.
- **403** — Forbidden.
- **500** — Server error (`error`: `SERVER_ERROR`).

---

## Error codes summary

| HTTP | `error` (or context) | Meaning |
|------|----------------------|---------|
| 401  | —                    | Missing or invalid JWT. |
| 403  | `INSUFFICIENT_PERMISSIONS` | Valid admin but missing `role.manage.all` (when permission checks are on). |
| 400  | `INVALID_ID`         | Invalid role ID (e.g. non-numeric). |
| 400  | `INVALID_USER_ID`    | Invalid user ID. |
| 400  | `INVALID_ROLE_ID`    | Invalid or missing role ID in body/path. |
| 400  | `MISSING_FIELDS`    | Required fields missing (e.g. name, display_name). |
| 400  | `INVALID_PERMISSIONS` | Permissions not sent as an array. |
| 400  | `NO_UPDATE_FIELDS`  | PUT with no updatable fields. |
| 404  | `NOT_FOUND`         | Role not found by ID. |
| 400  | `CREATE_FAILED`     | Create failed (e.g. duplicate name, invalid permissions). |
| 400  | `UPDATE_FAILED`     | Update failed (e.g. role not found, validation). |
| 400  | `DELETE_FAILED`     | Delete failed (e.g. system role, role in use). |
| 400  | `ASSIGN_FAILED`     | Assign failed (e.g. role not found, already assigned). |
| 400  | `REMOVE_FAILED`     | Remove failed (e.g. user does not have role). |
| 500  | `SERVER_ERROR`      | Unexpected server error. |

---

## Permission strings (reference)

Permissions follow the pattern **`resource.action.scope`**. Examples:

- `role.manage.all` — full role management (required for these APIs when RBAC is enforced).
- `user.manage.all`, `course.manage.all`, `admin.manage.all`, `teacher.manage.all`, `coupon.manage.all`, `bundle.manage.all`, etc.

The backend validates permission strings on create/update role; invalid values result in **400** with a message listing invalid permissions. For the full list of valid permissions, refer to the backend permission configuration or admin API permission mapping documentation.

---

## Frontend integration notes

1. **Auth:** Send the admin JWT on every request; handle **401** by redirecting to login and **403** by showing “You don’t have permission to manage roles.”
2. **IDs:** Use integer IDs for `id`, `userId`, `roleId` in path and body; non-numeric or missing IDs yield **400**.
3. **Permission list for roles:** When building the Create/Edit role form, call **GET /admin/roles/permissions** and use the returned `data.all` or `data.by_resource` to render the list of permissions. Do not hardcode the list on the frontend; this keeps it in sync with the backend.
4. **Create/update role:** Always send `name` and `display_name` on create; on update send at least one field. Validate that `permissions` is an array before sending. Only include permission strings that came from the permissions list API (or the backend will reject invalid ones with 400).
5. **Delete:** Before calling delete, you can warn if the role is a system role or still assigned to users; the API will enforce this and return **400** with a clear message.
6. **Assign/remove:** Check that the user does not already have the role before assigning; check that the user has the role before removing. The API returns **400** with clear messages if not.
7. **User permissions:** Use GET user permissions to drive feature visibility or role summary in the UI; cache or refetch after assign/remove role.

---

*Document version: 1.0 — Role Management API for frontend integration.*
