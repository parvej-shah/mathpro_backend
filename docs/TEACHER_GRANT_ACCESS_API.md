# Teacher "Grant Admin Panel Access" — API Details

The **"Grant Admin Panel Access"** checkbox in the teacher UI is **not** a separate API. It is the **`isPrivileged`** field handled by the same create/update teacher endpoints.

---

## 1. Which APIs control it

| Action | Method | Endpoint | Body field |
|--------|--------|----------|------------|
| **Create teacher** (set at creation) | POST | `/v2/admin/teacher/create-enhanced` | `isPrivileged: true \| false` |
| **Edit teacher** (change access) | PUT | `/v2/admin/teacher/:teacherId/update-enhanced` | `isPrivileged: true \| false` |

- **Permission:** `teacher.manage.all` (same as all teacher V2 routes).
- **Base URL:** Prefix with your API host, e.g. `https://api.example.com/v2/admin/teacher/...`.

---

## 2. Backend behavior

### Database

- **Table:** `managerial_auth`
- **Columns used:**
  - `is_privileged` (boolean) — kept for backward compatibility / reporting; effective access is driven by `type` and roles
  - `type` — `1` = admin (when granted), `3` = regular (when revoked)
  - `password` — not changed when granting; teacher uses existing password
- **Table:** `user_roles` — when granting, the **teacher** role is assigned; when revoking, the teacher role is removed

### When **granting** access (checkbox checked: `isPrivileged: true`)

**On update** ([service/managerial/teacherV2.js](service/managerial/teacherV2.js) `updateEnhanced`):

- **Validation:** Teacher must have an **email** to send credentials (admin template). Email is taken from the `email` column or from **login** when it looks like an email (contains `@`), since auth uses the login field for both email and phone.
- **DB:** `type = 1` (admin), `is_privileged = true`
- **Role:** System role **teacher** is assigned (insert into `user_roles`).
- **Password:** Not generated or updated; teacher keeps existing password.
- **Credentials notification:** An email is sent using the **same template as admin** ([AdminService.sendAdminCredentialsEmail](service/managerial/admin.js)); the password field in the email shows "Use your existing password".

**On create** (`createEnhanced`): Unchanged in this update; may be aligned in a follow-up.

### When **revoking** access (checkbox unchecked: `isPrivileged: false`)

**On update:**

- **Role:** The **teacher** role is removed from `user_roles`.
- **DB:** `type = 3` (regular), `is_privileged = false`
- Teacher can no longer log in to the admin panel.

---

## 3. Request / response (update — typical for “change access”)

**Request**

- **Method:** `PUT`
- **URL:** `/v2/admin/teacher/:teacherId/update-enhanced`
- **Headers:** `Authorization: Bearer <admin token>`, `Content-Type: application/json`
- **Body (minimal to only change access):**

```json
{
  "isPrivileged": true
}
```

Or to revoke:

```json
{
  "isPrivileged": false
}
```

You can send other fields in the same request (name, login, role, bio, courses_teaching, etc.); only `isPrivileged` is needed to change “Grant Admin Panel Access”.

**Response (200)**

- Same shape as other teacher update success responses (e.g. `success`, `data` with teacher id, name, login, type, is_privileged, etc.).

---

## 4. Where it’s implemented in code

| What | File | Notes |
|------|------|--------|
| Route | [routes/managerial/teacherV2.js](routes/managerial/teacherV2.js) | `PUT /:teacherId/update-enhanced` → `teacherControllerV2.updateEnhanced` |
| Controller | [controllers/managerial/teacherV2.js](controllers/managerial/teacherV2.js) | `updateEnhanced` — parses `teacherId`, passes `req.body` and `updatedBy` (req.user?.id ?? req.body.user_id) to service |
| Service (grant/revoke) | [service/managerial/teacherV2.js](service/managerial/teacherV2.js) | `updateEnhanced` — when granting: type=1, assign teacher role, require email, send credentials via admin email template (no new password); when revoking: remove teacher role, type=3, is_privileged=false |
| OpenAPI | [docs/managerial_teacher_v2/teacher_update_enhanced.js](docs/managerial_teacher_v2/teacher_update_enhanced.js) | `isPrivileged: { type: 'boolean' }` in request body |

---

## 5. Summary

- **“Grant Admin Panel Access”** = **`isPrivileged`** on create/update.
- **APIs:** `POST /v2/admin/teacher/create-enhanced` and **`PUT /v2/admin/teacher/:teacherId/update-enhanced`**.
- **Grant (checkbox on):** `type = 1` (admin), assign role **teacher**, `is_privileged = true`. Email required; credentials sent via **admin email template** (password text: "Use your existing password"). No new password generated.
- **Revoke (checkbox off):** Remove teacher role from `user_roles`, `type = 3`, `is_privileged = false`. Teacher cannot login.

Grant/revoke logic is implemented in [service/managerial/teacherV2.js](service/managerial/teacherV2.js) inside `updateEnhanced`.
