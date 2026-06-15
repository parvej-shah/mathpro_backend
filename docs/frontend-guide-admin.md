# Admin Frontend Guide — Course Schema Redesign

This documents what changed in the **course object** and related endpoints that the
admin/managerial dashboard talks to. Endpoints: `/v2/admin/course/*` (preferred) and the
deprecated `/admin/course/*` (sunset 2026-12-31, same shapes).

---

## 1. New flat fields on `course`

Add these to the admin course create/edit forms. They are returned by `GET` and must be
included in `PUT` (see **Full-replace warning** below).

| Field | Type | Notes |
|---|---|---|
| `slug` | string \| null | New pretty route id, e.g. `"discrete-mathematics"`. **Distinct from `url`** (which is unchanged — legacy external link). Must be unique. Used for the new public `getfull/slug/:slug` route. |
| `total_seats` | integer \| null | Seat cap. Pairs with existing `enrolled` count. |
| `tags` | array of strings \| null | e.g. `["math","discrete","university"]`. |
| `course_outline` | string (URL) \| null | Google Drive (or any) link to the syllabus/outline — same convention as `module.pdf_drive_link`. |

## 2. Removed field

- `study_plan_chips` — **fully removed** (column + API). Do not send it; it's no longer in
  `cols`. `you_get` is the array that replaces its purpose.

## 3. Redesigned `chips` JSON

`chips` is still a single JSON blob, but its shape changed completely. **Old `{label,value}`
wrappers everywhere are gone.** New shape:

```jsonc
{
  "bundle_id": 1,                          // int | null

  "thumbnails": {
    "course_thumbnail_16_9": "<url>",
    "trailer_video_thumb_16_9": "<url>",
    "facebook_community_thumb_16_9": "<url>"
  },

  "socials": {
    "facebook_community": "<url>",          // public
    "facebook_page": "<url>",               // public
    "facebook_private_group": "<url>",      // ENROLLED-ONLY (hidden by API for non-enrolled)
    "telegram_group": "<url>",               // NEW, ENROLLED-ONLY
    "whatsapp": "<url>",
    "messenger": "<url>",
    "phone": "tel:+8801xxxxxxxxx",
    "email": "mailto:support@example.com"
  },

  "sections": [                             // stat chips, was a label/value MAP, now an ARRAY
    { "label": "চ্যাপ্টার সংখ্যা", "value": "17 টি" },
    { "label": "ভিডিও ডিউরেশন",   "value": "100+ ঘণ্টা" }
  ],

  "enrollment_details": {                   // NEW — replaces old chips.enrollment block
    "prebooking_end_date": 1781000000,      // unix seconds, all optional/nullable
    "enrollment_end_date": 1782000000,
    "course_start_date":   1782500000
  }
}
```

### What's gone from `chips`
- Old `chips.enrollment` block with `prebooking_start/end`, `enrollment_start/end`, `classStart`,
  `classTime` → replaced by the smaller `chips.enrollment_details` (only 3 fields, unix seconds).
- `chips.trailer_video_link` → **removed entirely**. The single `intro_video` flat field is the
  only video link now; don't show a separate "trailer video" input.
- Any `{key, label, value}` triple in `sections` → now just `{label, value}` (label is the
  identifier, no separate key).

### Admin form impact
- Build dedicated form sections for `thumbnails` (3 image-URL inputs), `socials` (8 link/contact
  inputs incl. new **Telegram group**), `sections` (repeatable label/value rows), and
  `enrollment_details` (3 optional date pickers — convert to/from unix seconds on save/load).
- `bundle_id` stays a simple integer input (nullable).

## 4. Books — read-only surfacing (admin manages via separate Book module)

- Course `GET .../full` responses now include a `books: [...]` array — the books linked to that
  course via `course_book`. This is **read-only on the course form**; don't add a books field to
  the course create/update payload.
- To attach/detach books for a course, use the existing **Book admin endpoints**
  (`/admin/book/course/:courseId` — `GET` list, `POST` attach `{book_id}`; `DELETE
  /admin/book/course/:courseId/:bookId` to detach). This is a separate UI (e.g. a "Linked Books"
  tab on the course edit page) that calls the book module, not the course update payload.

## 5. Full-replace warning on `PUT`

`PUT /v2/admin/course/:courseId` (and `/admin/course/update/:id`) **replace every column** —
any field omitted from the request body is written as `NULL`. This was already true before this
redesign, but is now more important since there are more flat fields.

**The course edit form must always submit the complete course object** (all 20 fields, including
unchanged ones), not a partial diff. If your admin form currently does partial PATCH-style saves,
this will silently null out `description`, `chips`, `you_get`, etc.

## 6. Final field list (for reference)

`title, x_price, price, language, enrolled, you_get, chips, short_description, instructor_list,
faq_list, description, feedback_list, intro_video, is_live, serial, url, slug, total_seats, tags,
course_outline`

## 7. Summary checklist for the admin UI

- [ ] Add `slug`, `total_seats`, `tags`, `course_outline` inputs to the course form.
- [ ] Remove any `study_plan_chips` UI/state.
- [ ] Remove the "trailer video link" input (if separate from intro video).
- [ ] Rebuild the `chips` editor: thumbnails (3), socials (8, incl. Telegram), sections
  (label/value repeatable list), enrollment_details (3 optional dates, unix seconds).
- [ ] Add a read-only "Linked Books" panel sourced from `GET .../full` `books[]`, with
  attach/detach actions hitting `/admin/book/course/:courseId` endpoints.
- [ ] Ensure the edit form always sends the full course payload on save (no partial updates).
