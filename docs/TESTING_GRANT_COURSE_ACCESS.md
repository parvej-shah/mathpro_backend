# Testing Guide: Grant Course Access to a Student

Quick reference for granting a course to a test student account during local testing.

## Accounts used for testing

- **Admin account** (used to mint the auth token): `bsse1610@iit.du.ac.bd` (id=3, type=1 — "Test Admin")
- **Student account** (receives course access): `parvejshahlabib007@gmail.com` (id=1, type=3 — "Parvej Shah Labib")

> The grant-access endpoint only works when the target user is `type=3` (student).
> Admin accounts (`type=1`) will be rejected with `INVALID_TARGET_USER`.

## Steps

1. Make sure the backend server is running (default port `8000`).

2. Generate an admin token (from the backend root, so `.env` loads):

   ```bash
   cd Math_Pro_backend
   node scripts/make-token.js bsse1610@iit.du.ac.bd --all-permissions --quiet > /tmp/admin_token.txt
   ```

3. Grant course access to the test student:

   ```bash
   TOKEN=$(cat /tmp/admin_token.txt)
   curl -s -X POST "http://localhost:8000/admin/users/1/access?type=course" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"courseId": <COURSE_ID>}'
   ```

   Replace `<COURSE_ID>` with the course to grant (e.g. `9` for "SSC General Math | Target A+").

   Expected success response:

   ```json
   {"success":true,"data":{"user_id":1,"course_id":9,"amount":0,"transaction_id":null,"timestamp":...,"course":{"id":9,"title":"..."},"user":{"id":1,"type":3,"name":"Parvej Shah Labib"}}}
   ```

   If access was already granted, the API returns `409 DUPLICATE_ACCESS`.

## Other useful calls

- **List a user's course/bundle access**:

  ```bash
  curl -s "http://localhost:8000/admin/users/1/access?type=course" -H "Authorization: Bearer $TOKEN"
  curl -s "http://localhost:8000/admin/users/1/access?type=bundle" -H "Authorization: Bearer $TOKEN"
  ```

- **Revoke access**:

  ```bash
  curl -s -X DELETE "http://localhost:8000/admin/users/1/access?type=course" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"courseId": <COURSE_ID>}'
  ```

- **Grant bundle access** instead of course access — use `type=bundle` and `{"bundleId": <BUNDLE_ID>}`.

## Available course IDs (as of last check)

| id | title |
|----|-------|
| 7  | Discrete Mathematics Mastery |
| 8  | HSC Higher Math 1st Paper \| Prelim to Pro |
| 9  | SSC General Math \| Target A+ |
| 10 | Class 8 Math Master Batch 2026 |

Run this query to refresh the list:

```bash
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_DB,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
});
(async () => {
  const res = await pool.query('select id, title from course order by id');
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
})();
"
```
