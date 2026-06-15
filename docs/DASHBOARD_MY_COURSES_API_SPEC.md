# Dashboard "My Courses" API — Spec & Structure

Purpose-built listing for the student dashboard (`/dashboard`) course cards: the user's
**enrolled** individual courses and **purchased** bundles, each carrying exactly what a card
renders — thumbnail, slug, title, instructor, and progress — decoupled from the billing/coupon
data in `/user/payment/history`.

- **New endpoint:** `GET /user/course/my-dashboard`
- **Auth:** required (`authenticateUser`)

---

## 1. Why this endpoint exists

The dashboard previously built its course list from `GET /user/payment/history`. That endpoint's
`individual_courses[]` rows **do not include `chips`** (they carry billing fields: paid_amount,
transaction_id, coupon_*). With no `chips`, the cards had no thumbnail and fell back to generated
placeholders — and real thumbnails were only fetched for the single "resume" course via the
per-course `dashboard/:id` call.

`my-dashboard` is a clean, dashboard-shaped read: it returns enrolled courses + purchased bundles
with `chips` (thumbnail), `slug` (for routing), `instructor_list`, and server-computed `progress`,
so every card shows a real thumbnail in one request — no per-card `getfull` calls, no billing noise.

`/user/payment/history` is unchanged; it remains the source for transaction/coupon history.

---

## 2. Endpoint

```
GET /user/course/my-dashboard
Authorization: Bearer <token>
```

### Response

```jsonc
{
  "success": true,
  "data": {
    "individual_courses": [
      {
        "id": 7,
        "title": "Discrete Mathematics Mastery",
        "slug": "discrete-mathematics-v2",      // route slug (null for legacy courses)
        "short_description": "…",
        "chips": { /* new chips shape — read thumbnail via chips.thumbnails.course_thumbnail_16_9 */ },
        "tags": ["math", "discrete"],
        "instructor_list": { "instructors": [{ "name": "…" }] },
        "is_live": true,
        "intro_video": "…",
        "enrollment_date": 1781286947,            // unix seconds (from `takes.timestamp`)
        "total_modules": 12,
        "completed_modules": 3,
        "last_accessed": 1781290000,              // unix seconds, null if never opened
        "progress_percentage": 25                 // round(completed/total*100), 0 if no modules
      }
    ],
    "bundle_purchases": [
      {
        "id": 1,
        "title": "…",
        "short_description": "…",
        "chips": { /* bundle chips (bundle_thumb_* lives here) */ },
        "intro_video": "…",
        "is_live": true,
        "purchase_date": 1781286947,              // unix seconds
        "courses": [
          {
            "id": 8,
            "title": "…",
            "slug": "…",
            "chips": { /* per-course chips → thumbnail */ },
            "instructor_list": { "instructors": [{ "name": "…" }] },
            "total_modules": 12,
            "completed_modules": 4,
            "progress_percentage": 33
          }
        ]
      }
    ]
  }
}
```

On failure: `{ "success": false, error }` with HTTP 400.

### Field notes
- **Thumbnail**: `chips.thumbnails.course_thumbnail_16_9` (new chips shape — see
  `frontend-guide-user.md §4`). Falls back to a generated placeholder client-side if absent.
- **progress_percentage**: computed server-side from the `progress` table
  (`completed distinct modules / total modules`), so the frontend doesn't recompute.
- **bundle child courses** carry the same server-computed `total_modules` / `completed_modules` /
  `progress_percentage` as individual courses.

---

## 3. Frontend integration

- Hook: [`useMyDashboard`](../../MathPro_Frontend/src/hooks/useMyDashboard.ts) — React Query wrapper.
- Wired into [`useDashboardData`](../../MathPro_Frontend/src/components/Dashboard/DashboardPage/useDashboardData.ts):
  builds a `courseId → { thumbnail, slug, progress }` map and uses it for the dashboard cards,
  replacing the placeholder-only thumbnail. `/payment/history` is still fetched for the
  transaction/coupon-dependent parts of the page.
- Thumbnail read via `getCourseThumbnail(chips)` from
  `features/course-details/_lib/chips.ts`.

---

## 4. Files touched

| File | Change |
|---|---|
| `service/managerial/course.js` | Added `getMyDashboard(user_id)` |
| `controllers/user/course.js` | Added `getMyDashboard` controller method |
| `routes/user/course.js` | Registered `GET /user/course/my-dashboard` |

No database migration. No change to `/user/payment/history` or any existing endpoint.
