# Shared FAQ Admin Integration Guide

This FAQ module is the single source of truth for:

- homepage FAQ section
- `/courses` FAQ section
- `/courses/[id]` shared FAQ section

## Backend endpoints

Public:

- `GET /user/faq/list`

Admin:

- `GET /admin/faq/list`
- `GET /admin/faq/get/:id`
- `POST /admin/faq/create`
- `PUT /admin/faq/update/:id`
- `DELETE /admin/faq/delete/:id`

Admin endpoints currently require the existing `course.manage.all` permission.

## FAQ payload

```json
{
  "question": "কোর্সের পেমেন্ট কিভাবে করব?",
  "answer": "বিকাশ, নগদ, রকেট এবং যেকোনো ব্যাংক কার্ড দিয়ে পেমেন্ট করতে পারবে।",
  "category": "payment",
  "sort_order": 4,
  "is_active": true
}
```

## Supported categories

- `courses`
- `enrollment`
- `payment`
- `support`

`category` is optional, but the `/courses` page uses it for filter chips. If it is omitted, the FAQ still appears in the full list and on pages that do not filter.

## Admin UI expectations

Recommended table columns:

- serial / drag handle
- question
- category
- status (`Active` / `Hidden`)
- last updated
- actions (`Edit`, `Delete`)

Recommended form fields:

- `question`: plain text input
- `answer`: rich text editor or multiline textarea
- `category`: select
- `sort_order`: number input
- `is_active`: toggle

Recommended behavior:

1. Load `GET /admin/faq/list` on page open.
2. Sort rows by `sort_order`, then by `id`.
3. Use `is_active=false` to hide an item without deleting it.
4. Use `sort_order` for manual ordering across all public pages.
5. Send full payload on create/update.

## Frontend dependency

The public frontend now reads `GET /user/faq/list` directly. Any admin save is reflected on:

- `/`
- `/courses`
- `/courses/[id]`

No course-specific FAQ editing is needed for this shared block anymore.
