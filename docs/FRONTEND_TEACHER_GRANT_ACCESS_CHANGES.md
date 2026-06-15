# Frontend: Teacher "Grant Admin Panel Access" — What Changed

Short summary for frontend: same API and request body; new validation and backend behavior when toggling the checkbox.

---

## Same as before

- **API:** Still `PUT /v2/admin/teacher/:teacherId/update-enhanced` with body `{ "isPrivileged": true }` or `{ "isPrivileged": false }`.
- **Checkbox:** Still maps to `isPrivileged`; you can send it alone or with other teacher fields (name, login, etc.).

---

## What changed (for frontend)

### 1. Granting can fail if teacher has no email

When the user **turns the checkbox ON** (grant access), the backend **requires an email** to send the credentials (same template as admin). It derives email from:
- the **email** column if set, or
- the **login** field when it looks like an email (contains `@`).

So if you store the teacher’s email in **login** (as your auth system does), the backend treats that as the email for grant and no separate email column is needed.

The backend also **keeps email/phone in sync with login**: when email or phone is missing, it sets them from the login value (email if login contains `@`, otherwise phone) on create and on update. So login is the source of truth; email/phone are filled in to match.

- If the teacher has **no email** (and login is not an email), the API returns:
  - **Status:** `422` (or `400`)
  - **Body:**  
    `{ "success": false, "error": "Email is required to grant admin panel access so we can send credentials by email.", "code": "VALIDATION_ERROR", "details": { "email": "..." } }`

**Frontend:** Before calling the API with `isPrivileged: true`, you can optionally check that the teacher has an email and show a message like: “Email is required to grant admin panel access.” If you don’t check, the API will respond with the error above — show `error` (or `details.email`) to the user.

### 2. No new password when granting

When access is **granted**, the backend **does not** generate a new password. The teacher keeps their existing password. They receive an **email** (same template as admin) that says to use their existing password.

- No change to your request/response; only backend behavior.
- You can keep any “credentials sent” message; the user gets an email instead of SMS.

**What if the teacher has no existing password?**  
Every teacher gets a password when they are **created** (backend always sets one). If they were created **without** admin access, that password was never sent to them, so they don't know it. The grant email still says "Use your existing password." In that case the teacher should use the **password reset / Forgot password** flow on the login page to set a new one. No change needed on the frontend for grant; just ensure the login page has a working "Forgot password" (or equivalent) for teachers.

### 3. Revoking

When the user **turns the checkbox OFF** (revoke access), the backend removes the teacher role and sets the user to regular (no admin access). No new validations or errors for the frontend.

---

## Quick checklist

| Scenario | Action |
|----------|--------|
| User turns “Grant Admin Panel Access” **ON** | Send `PUT .../update-enhanced` with `{ "isPrivileged": true }`. Handle `VALIDATION_ERROR` and show error if backend returns “Email is required…”. |
| User turns “Grant Admin Panel Access” **OFF** | Send `PUT .../update-enhanced` with `{ "isPrivileged": false }`. No new validation. |
| Teacher edit form | If you have an email field, consider disabling “Grant Admin Panel Access” or showing a hint when email is missing, so the user knows grant may fail. |

---

## Error response shape (grant without email)

```json
{
  "success": false,
  "error": "Email is required to grant admin panel access so we can send credentials by email.",
  "code": "VALIDATION_ERROR",
  "details": {
    "email": "Email is required to send credentials using the admin email template."
  }
}
```

Use `error` or `details.email` for the message in the UI.
