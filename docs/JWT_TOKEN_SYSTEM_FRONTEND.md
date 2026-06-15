# JWT Token System — Frontend Developer Guide

This document describes the **JWT token system** for the **admin/managerial** login flow so frontend developers can authenticate, store, and use the token correctly.

---

## 1. Overview

- **Admin/managerial login** returns a **JWT** and a **user** object that includes **roles** and **permissions**.
- The **same payload** (including `roles` and `permissions`) is **inside the JWT**. You can either use the login response directly or decode the token to read user info after refresh.
- The backend uses **permission-based** checks for most admin APIs: the token must contain a `permissions` array, and the requested endpoint may require a specific permission (e.g. `user.manage.all`).
- **Student/regular user** login uses a **different** auth flow and token shape; this guide is only for **admin panel** (managerial) tokens.

---

## 2. Login (how to get the token)

**Endpoint (managerial):**

- **POST** `/admin/auth/login`  
  (Base URL is your API host, e.g. `https://api.example.com`.)

**Request body (e.g. JSON):**

```json
{
  "login": "admin@example.com",
  "password": "your_password"
}
```

- `login` is the account **email address**.
- `password` is plain text (sent over HTTPS).

**Success response (200):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 61,
    "name": "Admin Name",
    "type": 1,
    "loginType": "email",
    "email": "admin@example.com",
    "phone": null,
    "roles": [
      { "id": 12, "name": "super_admin", "display_name": "Super Administrator" }
    ],
    "permissions": [
      "user.manage.all",
      "admin.manage.all",
      "course.manage.all",
      "role.manage.all",
      "analytics.manage.all"
    ]
  }
}
```

- **`token`** — JWT string. Send this in the `Authorization` header for all protected admin API calls.
- **`user`** — Same identity and RBAC data you can get from the token: `id`, `type`, `roles`, `permissions`, etc. You can store this in your app state and use it without decoding the token.

**Error responses:**

- **401 / 403** — Invalid credentials or not allowed.
- Response body usually has `success: false`, `error`, and optionally `message`.

---

## 3. JWT payload (what’s inside the token)

If you **decode** the JWT (e.g. with `jwt-decode` or any JWT library) **without verifying** (verification is done by the backend), you get a payload like:

```json
{
  "id": 61,
  "name": "Admin Name",
  "type": 1,
  "login": "admin@example.com",
  "loginType": "email",
  "profile": { ... },
  "roles": [
    { "id": 12, "name": "super_admin", "display_name": "Super Administrator" }
  ],
  "permissions": [
    "user.manage.all",
    "admin.manage.all",
    "course.manage.all",
    "role.manage.all",
    "analytics.manage.all"
  ],
  "createdAt": 1736234567890
}
```

| Field          | Type     | Description |
|----------------|----------|-------------|
| `id`           | number   | User ID (managerial_auth id). |
| `name`         | string   | Display name. |
| `type`         | number   | Account type: `1` = admin, `2` = moderator, `3` = regular. Admin APIs expect `1` or `2`. |
| `login`        | string   | Email address used for login. |
| `loginType`    | string   | Always `"email"` for this flow. |
| `profile`      | object   | Optional profile data (may be omitted in some flows). |
| `roles`        | array    | List of `{ id, name, display_name }`. |
| `permissions`  | array    | List of permission strings (e.g. `"user.manage.all"`). **Required** for permission-protected routes. |
| `createdAt`    | number   | Token creation time (ms). |

**Important:**

- Only **managerial login** (admin/moderator) tokens include **`roles`** and **`permissions`**.
- **Student/regular** tokens (from a different login path) do **not** have this RBAC shape; do not use them for admin APIs.

---

## 4. Sending the token to the API

**Header (required for protected admin routes):**

```http
Authorization: Bearer <token>
```

Example:

```javascript
fetch(`${API_BASE}/admin/users`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

- Use the **exact** token string returned in the login response (no prefix/suffix).
- If the token is missing or invalid/expired, the API returns **401** or **403** with a body like `{ success: false, error: 'NO_TOKEN' | 'INVALID_TOKEN' | 'INSUFFICIENT_PERMISSIONS' }`.

---

## 5. Token expiry and refresh

- **Expiry:** Tokens are signed with an expiry (e.g. **7 days**; configurable via `JWT_EXPIRES_IN` on the server).
- **Refresh:** This API does **not** describe a dedicated refresh endpoint. When the token expires, the user must **log in again** to get a new token.
- **Frontend:** Store the token securely (e.g. memory + optional httpOnly cookie or secure storage). On **401/403** from any admin API, redirect to login and clear the stored token.

---

## 6. Using roles and permissions on the frontend

- **After login:** Store `user.permissions` and `user.roles` (and optionally the full `user`) in your state (e.g. React context, Redux, Zustand). You do **not** have to decode the JWT for this if you use the login response.
- **After page refresh:** If you only persisted the token, decode the JWT (client-side, no verification) to read `decoded.permissions` and `decoded.roles` and restore UI state.
- **Visibility:** Use `permissions` to show/hide admin dashboard tabs or features. Example: show “Users” tab only if `permissions.includes('user.manage.all')`.
- **API calls:** Always send the token in `Authorization: Bearer <token>`. The backend checks permissions; if the user lacks the required permission, the API returns **403** with `error: 'INSUFFICIENT_PERMISSIONS'`.

**Example helper:**

```javascript
function hasPermission(permissions, required) {
  if (!Array.isArray(permissions)) return false;
  const need = Array.isArray(required) ? required : [required];
  return need.some(p => permissions.includes(p));
}

// Usage
if (hasPermission(user.permissions, 'user.manage.all')) {
  // show Users tab or action
}
```

---

## 7. Account types (for reference)

| type | Value | Meaning |
|------|--------|---------|
| admin | 1 | Administrator |
| moderator | 2 | Moderator |
| regular | 3 | Regular user (student) |

Admin panel APIs expect tokens with **type 1 or 2** and a valid **permissions** array for permission-protected routes.

---

## 8. Summary for frontend

| Task | Action |
|------|--------|
| Log in | **POST** `/admin/auth/login` with `{ login, password }`. |
| Get token & user | Use `response.token` and `response.user` (with `user.permissions`, `user.roles`). |
| Call admin APIs | Send header `Authorization: Bearer <token>`. |
| Show/hide UI | Use `user.permissions` (or decoded token `permissions`) with your frontend’s route-to-permission mapping. |
| Handle errors | On 401/403, treat as “not authenticated” or “not allowed” and redirect to login or show an error. |
| Expiry | Token has a limited lifetime; re-login when expired (no refresh endpoint in this doc). |

This is the **new JWT token system** for the admin frontend: one login response with token + user (including roles and permissions), one way to send the token, and permission-based UI and API access.
