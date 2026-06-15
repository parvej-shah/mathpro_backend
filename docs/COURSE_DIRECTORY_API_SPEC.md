# Course Directory API — Spec & Structure

Grouped, category-wise public course listing for the homepage and `/courses` page, modeled on
ft.education (the edtech we follow as pioneer). FT's homepage is driven by a single nested
endpoint that returns **category → courses**; this document specifies the MathPro equivalent.

- **New endpoint:** `GET /user/course/directory`
- **Existing flat endpoint (unchanged):** `GET /user/course/list`
- **Reference (FT):** `GET https://webapp.ft.education/api/course-directory`

---

## 1. Why this endpoint exists

The MathPro homepage (`src/components/landing-page.tsx`) renders courses in **category sections**
(Class 8 / SSC / HSC / Admission / Skill Development), each with its own row of cards — exactly
like FT's homepage. Until now those sections were **hardcoded** (`groupedCourses` in
`landing-page.tsx`), and the only live API was `GET /user/course/list`, which returns a **flat,
ungrouped array** of live courses. The `/courses` page consumed that flat list and grouped/filtered
client-side by `is_live` only — there was no server-side category grouping.

`GET /user/course/directory` closes that gap: it returns live courses already grouped into
categories, in display order, so the homepage and course page can render category sections
directly from the API instead of hardcoded data.

### How it compares to FT

| | FT `/api/course-directory` | MathPro `/user/course/directory` |
|---|---|---|
| Nesting | category → **subcategory** → courses | category → courses (no subcategory layer) |
| Category source | dedicated category/subcategory tables | derived from each course's `tags` array |
| Course object | FT course shape (`course_name`, `course_thimbnail`, …) | **same object as `/user/course/list`** (`title`, `chips`, `instructor_list`, …) |
| Auth | public | public (no auth) |

We deliberately **flattened out FT's subcategory layer** — MathPro has no subcategory concept — and
we **reuse the existing course object** rather than inventing FT's field names, so the frontend
`Course` type (`features/courses-page/_lib/types.ts`) works unchanged inside each category bucket.

---

## 2. Endpoint

```
GET /user/course/directory
```

- **Auth:** none (public).
- **Query params:** none.
- **Returns:** all `is_live = true` courses, grouped by category, ordered by category display
  order, courses within a category ordered by `serial`.

### Response

```jsonc
{
  "success": true,
  "data": [
    {
      "id": 3,                       // stable display index of the category (1-based)
      "slug": "hsc",                 // category slug
      "category_name": "HSC",        // display label
      "courses": [ /* full course objects, same shape as /user/course/list */ ]
    },
    {
      "id": 2,
      "slug": "ssc",
      "category_name": "SSC",
      "courses": [ /* ... */ ]
    }
    // ...only categories that contain ≥1 live course are present
  ]
}
```

On failure: `{ "success": false, ... }` with HTTP 400.

### Course object inside `courses[]`

Each element is the **same row** `GET /user/course/list` returns — no transformation. Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | integer | |
| `title` | string | |
| `x_price` | integer | strike-through / original price |
| `price` | integer | current price |
| `language` | string | |
| `enrolled` | integer | |
| `you_get` | json (array) | "what you'll get" bullets |
| `chips` | json | card chips — see `frontend-guide-user.md §4` for the new shape |
| `short_description` | string | |
| `instructor_list` | json `{ instructors: [...] }` | |
| `faq_list` | json | |
| `description` | string | |
| `feedback_list` | json `{ feedbacks: [...] }` | |
| `intro_video` | string\|null | |
| `is_live` | boolean | always `true` here |
| `serial` | integer | sort order within category |
| `url` | string | legacy external link (not a route) |
| `slug` | string\|null | route slug; use with `getfull/slug/:slug` |
| `total_seats` | integer\|null | |
| `tags` | json (array of strings) | drives category grouping (see §3) |
| `course_outline` | string (URL)\|null | |
| `isActive` | boolean | |

---

## 3. How categories are derived — `tags` (no schema change)

MathPro has **no category/subcategory table**. The `course` table has a free-form `tags` JSON
array, and categories are derived from it at request time. The taxonomy lives in
`CourseService.DIRECTORY_CATEGORIES` (`service/managerial/course.js`):

| Display order | `slug` | `category_name` | Tag values that match (case-insensitive) |
|---|---|---|---|
| 1 | `class-8` | Class 8 | `class 8`, `class8`, `class-8`, `অষ্টম শ্রেণি`, `অষ্টম` |
| 2 | `ssc` | SSC | `ssc`, `এসএসসি`, `মাধ্যমিক` |
| 3 | `hsc` | HSC | `hsc`, `এইচএসসি`, `উচ্চ মাধ্যমিক` |
| 4 | `admission` | ADMISSION | `admission`, `এডমিশন`, `ভর্তি` |
| 5 | `skill-development` | Skill Development | `skill development`, `skill-development`, `skill`, `স্কিল` |
| — | `other` | Other | (catch-all; any live course matching none of the above) |

Rules:

- Matching is **case-insensitive** and trims whitespace; both English and Bengali tag spellings
  are recognized.
- A course lands in the **first** category (by display order) whose match set hits any of its tags.
- Categories with **zero** live courses are **omitted** from `data` (no empty sections).
- Any live course whose tags match no category goes into a trailing **`Other`** bucket, so nothing
  live ever disappears from the page. With seed/test data (no category tags set), expect a single
  `Other` category — this is correct, not a bug.

### Operational note — tagging courses

For a course to appear under a category, an admin must add the matching tag (e.g. `HSC`) to the
course's `tags`. To add a new category or alias, edit `DIRECTORY_CATEGORIES`; no migration needed.
If/when a real category table is introduced later, this endpoint's response shape can stay the same
while the derivation source changes.

---

## 4. Frontend integration

### Homepage (`src/components/landing-page.tsx`)

Replace the hardcoded `groupedCourses` constant with data from this endpoint. Each `data[]` entry
maps to one category section (`group.category` → `category_name`); render `courses[]` as cards.
The FT screenshot's tab strip ("সকল (HSC)", "HSC 2026", …) is a **client-side** sub-filter over a
category's courses — derive tabs from the `tags` present on that category's courses if desired; the
API does not return tabs.

### `/courses` page (`features/courses-page/hooks/useCoursesPage.ts`)

Optional: switch the `["courses"]` query from `/user/course/list` to `/user/course/directory` to get
server-side category grouping, then flatten for the existing flat grid, or render per-category. The
flat `/user/course/list` endpoint remains available and unchanged for code that wants the flat array.

### Example fetch

```ts
const res = await axios.get(`${BACKEND_URL}/user/course/directory`);
if (!res.data.success) throw new Error("Failed to fetch course directory");
const categories = res.data.data; // [{ id, slug, category_name, courses: Course[] }]
```

---

## 5. Files touched

| File | Change |
|---|---|
| `service/managerial/course.js` | Added `DIRECTORY_CATEGORIES` + `directoryForUser(req)` |
| `controllers/user/course.js` | Added `directory` controller method |
| `routes/user/course.js` | Registered `GET /user/course/directory` (static route, ahead of `/:courseId/*`) |

No database migration. No change to `GET /user/course/list` or any existing endpoint.
