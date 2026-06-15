# User/Public Frontend Guide — Course Schema Redesign

This documents what changed for the public site (landing pages, course pages, dashboard) that
consumes `/user/course/*` endpoints.

---

## 1. New route — get a course by slug

```
GET /user/course/getfull/slug/:slug
```

- New, alongside the existing `GET /user/course/getfull/:id`. Returns the **exact same payload**
  (optionally authenticated via `optAuthenticateUser`, so logged-in users get
  `isTaken`/`isWishList` etc. as before).
- Use this for pretty course URLs like `/courses/discrete-mathematics` instead of
  `/courses/42`. `slug` is a **new field**, distinct from the old `url` field (which is unchanged
  — still the legacy external link, not a route).
- If a course has no `slug` set, this route 400s — fall back to the numeric `getfull/:id` route
  for older courses, or ensure all courses have a slug.

## 2. New fields on the course object (`getfull/:id` and `getfull/slug/:slug`)

| Field | Type | Where to show it |
|---|---|---|
| `slug` | string \| null | Used for routing, not usually displayed. |
| `total_seats` | integer \| null | "X / total_seats seats filled" alongside existing `enrolled`. |
| `tags` | array of strings \| null | Tag chips/badges on the course card or page. |
| `course_outline` | string (URL) \| null | "View Course Outline" link/button (opens Drive link). |
| `attached_books` | array of book objects | Each: `{id, title, image_url, price, class_levels, tags, description}`. Show as a "Books included" section if non-empty. |
| `books_total` | integer | Sum of `attached_books[].price` — useful if books are bundled into the price display. |

## 3. Removed field

- `study_plan_chips` — gone entirely. If the old landing page rendered a "study plan" section
  from this, remove that code; `you_get` (array) already covers "what you'll get".

## 4. Redesigned `chips` — read it with the new shape

`chips` is still JSON on the course object, but the **shape changed** (no more `{label,value}`
wrappers, no `chips.enrollment` block, no `chips.trailer_video_link`):

```jsonc
{
  "bundle_id": 1,
  "thumbnails": {
    "course_thumbnail_16_9": "<url>",
    "trailer_video_thumb_16_9": "<url>",
    "facebook_community_thumb_16_9": "<url>"
  },
  "socials": {
    "facebook_community": "<url>",
    "facebook_page": "<url>",
    "facebook_private_group": "<url>",   // only present/non-null for enrolled users (dashboard)
    "telegram_group": "<url>",            // NEW — only present/non-null for enrolled users
    "whatsapp": "<url>", "messenger": "<url>",
    "phone": "tel:...", "email": "mailto:..."
  },
  "sections": [
    { "label": "চ্যাপ্টার সংখ্যা", "value": "17 টি" },
    { "label": "ভিডিও ডিউরেশন", "value": "100+ ঘণ্টা" }
  ],
  "enrollment_details": {
    "prebooking_end_date": 1781000000,   // unix seconds, all optional
    "enrollment_end_date": 1782000000,
    "course_start_date": 1782500000
  }
}
```

### Landing page rendering changes
- **Thumbnails**: read `chips.thumbnails.course_thumbnail_16_9` (main course image),
  `trailer_video_thumb_16_9`, `facebook_community_thumb_16_9` — same keys as before, just nested
  consistently.
- **Trailer video**: there's no separate trailer link anymore. Use the course's `intro_video`
  (flat field) for any "watch intro/trailer" video player/button.
- **Stat chips**: `chips.sections` is now a flat array of `{label, value}` — map directly to your
  stat-chip components (e.g. "17 টি চ্যাপ্টার", "100+ ঘণ্টা ভিডিও"). No more nested label/value map
  with redundant keys.
- **Social/contact links**: `chips.socials` — same fields as before plus new `telegram_group`.
  Add a Telegram button/link if you show a social bar.
- **Enrollment countdown / schedule**: replace any old `chips.enrollment.{prebooking_start,
  prebooking_end, enrollment_start, enrollment_end, classStart, classTime}` usage with
  `chips.enrollment_details.{prebooking_end_date, enrollment_end_date, course_start_date}`
  (unix seconds — `new Date(value * 1000)` to display). All three are optional/nullable — hide
  the corresponding UI element if `null`.

## 5. Dashboard (`GET /user/course/dashboard/:id`) — new response shape

This endpoint is **enrolled-only** (400 if not authenticated or not enrolled — unchanged
behavior). The success response is reshaped into named sections:

```jsonc
{
  "success": true,
  "data": {
    "id": 7,
    "title": "...",
    "short_description": "...",

    "thumbnails": {
      "course_thumbnail_16_9": "...",
      "trailer_video_thumb_16_9": "...",
      "facebook_community_thumb_16_9": "..."
    },

    "media": {
      "intro_video": "..."                 // NEW grouping — use for the dashboard video player
    },

    "progress": {
      "maxModuleSerialProgress": 0,
      "totalModules": 0,
      "totalChapters": 0,
      "completedModules": 0,
      "progressPercentage": 0
    },

    "instructor": { "name": "...", "credibility": "..." },

    "community": {
      "facebook_community": "...",
      "facebook_page": "...",
      "facebook_private_group": "...",     // real link (always non-null here — enrolled-only endpoint)
      "telegram_group": "...",              // NEW — real link, enrolled-only endpoint
      "whatsapp": "...", "phone": "...", "email": "..."
    },

    "enrollment": {
      "enrollment_date": 1781286947,
      "is_enrolled": true,
      "total_seats": 250,                  // NEW
      "enrolled": 0                        // NEW
    },

    "enrollment_details": {                 // NEW — replaces any old "schedule" block
      "prebooking_end_date": 1781000000,
      "enrollment_end_date": 1782000000,
      "course_start_date": 1782500000
    },

    "metadata": {
      "is_live": true,
      "language": "Bangla",
      "url": "...",
      "slug": "discrete-mathematics",      // NEW
      "tags": ["math","discrete"],          // NEW
      "course_outline": "..."               // NEW
    }
  }
}
```

### Dashboard UI changes
- Read the intro/trailer video from `data.media.intro_video` (was previously a top-level/other
  field — now grouped).
- Show `data.enrollment.total_seats` / `data.enrollment.enrolled` if you display capacity.
- Add a **Telegram group** button next to the existing Facebook private group button in
  `data.community`.
- Replace any "schedule" section with `data.enrollment_details` (3 optional unix-second dates —
  hide rows that are `null`).
- Show `data.metadata.tags` as badges and `data.metadata.course_outline` as an "Outline" link if
  present.

## 6. Private links — visibility rule (unchanged principle, new field)

- On the **public course page** (`getfull`), `chips.socials.facebook_private_group` and
  `chips.socials.telegram_group` should be treated as **enrolled-only** — don't render them for
  anonymous/non-enrolled users even if present in the raw `chips` JSON (the API doesn't strip
  them on the public `getfull` route, only the dashboard route is gated). Gate display in the
  frontend based on `isTaken`/enrollment status returned alongside `getfull`.
- On the **dashboard** (enrolled-only route), both are always safe to show.

## 7. Quick checklist

- [ ] Switch course page routing to `GET /user/course/getfull/slug/:slug` where a slug exists.
- [ ] Update `chips` readers: `thumbnails`, `socials` (+ Telegram), `sections` (array of
  label/value), `enrollment_details` (unix seconds).
- [ ] Remove trailer-video-specific UI; use `intro_video`.
- [ ] Remove any `study_plan_chips` rendering.
- [ ] Add `tags`, `total_seats`, `course_outline`, `attached_books`/`books_total` to the course
  page where relevant.
- [ ] Update the dashboard page for the new `media` / `enrollment_details` / `metadata` groupings
  and the new `telegram_group` link.
- [ ] On the public course page, hide `facebook_private_group` / `telegram_group` for
  non-enrolled visitors (frontend-side gating).
