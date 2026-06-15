# Student History & Access API — Frontend Developer Guide

This document explains how to integrate the new admin student APIs into the admin panel.

---

## Overview

These APIs support:

- Student list/details (existing under `/admin/users`)
- Student full history view (new)
- Student access management for both course and bundle (new unified endpoint)

Recommended admin frontend routes:

- `/students`
- `/students/:id`
- `/students/:id/history`
- `/students/:id/access`

---

## Base URL and Auth

- Base API URL: `http://localhost:4000` (or your deployed API host)
- Admin base path: `/admin/users`
- Required auth header for all endpoints:

`Authorization: Bearer <admin_token>`

---

## Required Permission

All APIs in this doc require:

- `user.manage.all`

If missing, backend returns `403` with `INSUFFICIENT_PERMISSIONS` or `NO_PERMISSIONS`.

---

## Endpoints

### 1) Get Student History

**GET** `/admin/users/:id/history`

Returns one consolidated response with:

- `user`
- `summary`
- `purchases` (from `takes` + `bundle_purchase`)
- `progress`
- `feedbacks`
- `module_feedbacks`
- `submissions`

Detailed structure:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "name": "string",
      "type": "number (expected 3 for student)",
      "login": "string",
      "email": "string|null",
      "phone": "string|null",
      "created_at": "ISO datetime string",
      "updated_at": "ISO datetime string"
    },
    "summary": {
      "purchases": "number",
      "progress_entries": "number",
      "feedbacks": "number",
      "module_feedbacks": "number",
      "submissions": "number"
    },
    "purchases": [
      {
        "user_id": "number",
        "item_id": "number",
        "item_type": "course|bundle",
        "amount": "number|null",
        "coupon_id": "number|null",
        "transaction_id": "string|null",
        "purchased_at": "number|null (unix seconds)",
        "course_title": "string|null",
        "bundle_title": "string|null"
      }
    ],
    "progress": [
      {
        "user_id": "number",
        "module_id": "number",
        "point": "number|null",
        "timestamp": "number|null (unix seconds)",
        "module_title": "string|null",
        "module_serial": "number|null",
        "chapter_id": "number|null",
        "chapter_title": "string|null",
        "course_id": "number|null",
        "course_title": "string|null"
      }
    ],
    "feedbacks": [
      {
        "id": "string (uuid)",
        "user_id": "string",
        "course_id": "string",
        "rating": "number",
        "comment": "string|null",
        "category": "string|null",
        "created_at": "ISO datetime string",
        "updated_at": "ISO datetime string",
        "course_title": "string|null"
      }
    ],
    "module_feedbacks": [
      {
        "id": "number",
        "user_id": "number",
        "module_id": "number",
        "reaction": "string (like|dislike etc.)",
        "reason": "string|null",
        "comment": "string|null",
        "created_at": "ISO datetime string",
        "updated_at": "ISO datetime string",
        "module_title": "string|null",
        "chapter_id": "number|null",
        "chapter_title": "string|null",
        "course_id": "number|null",
        "course_title": "string|null"
      }
    ],
    "submissions": [
      {
        "user_id": "number",
        "module_id": "number",
        "submission": "object|null",
        "evaluation": "object|null",
        "status": "string|null",
        "updated_at": "number|null (unix seconds)",
        "module_title": "string|null",
        "chapter_id": "number|null",
        "chapter_title": "string|null",
        "course_id": "number|null",
        "course_title": "string|null"
      }
    ]
  }
}
```

Example:

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/admin/users/3969/history"
```

---

### 2) Unified Student Access API

Use one endpoint for both course and bundle access.

#### 2.1 Get access list

**GET** `/admin/users/:id/access?type=course`

or

**GET** `/admin/users/:id/access?type=bundle`

#### 2.2 Grant access

**POST** `/admin/users/:id/access`

Body for course:

```json
{
  "type": "course",
  "courseId": 1
}
```

Body for bundle:

```json
{
  "type": "bundle",
  "bundleId": 1
}
```

#### 2.3 Revoke access

**DELETE** `/admin/users/:id/access?type=course&courseId=1`

or

**DELETE** `/admin/users/:id/access?type=bundle&bundleId=1`

---

## Validation Rules

- `type` must be `course` or `bundle`
- For `type=course`, `courseId` is required
- For `type=bundle`, `bundleId` is required
- Target user must be a student (`type = 3`) for grant operations

---

## Expected Errors

- `400`:
  - `INVALID_TYPE`
  - `MISSING_COURSE_ID`
  - `MISSING_BUNDLE_ID`
  - `INVALID_TARGET_USER`
- `404`:
  - `NOT_FOUND` (user/course/bundle/access not found)
- `409`:
  - `DUPLICATE_ACCESS`
- `401`/`403`:
  - auth or permission issues

---

## Frontend Page Mapping


### `/students/:id/history`

- Call `GET /admin/users/:id/history`
- Suggested sections:
  - Summary cards from `summary`
  - Purchases table
  - Progress table (sortable by latest timestamp)
  - Feedback tabs (`feedbacks`, `module_feedbacks`)
  - Submissions table

### `/students/:id/access`

- Toggle/filter between:
  - Course access (`type=course`)
  - Bundle access (`type=bundle`)
- Actions:
  - Grant
  - Revoke
- After action success, re-fetch current tab list

---

## Suggested Frontend API Helpers

```ts
getStudentHistory(id)
getStudentAccess(id, type) // type: 'course' | 'bundle'
grantStudentAccess(id, payload) // { type, courseId? , bundleId? }
revokeStudentAccess(id, type, entityId)
```

---

## Notes for Implementation

- Use only `/admin/users/:id/access`.
- History payload can be large for active students; add lazy rendering/table virtualization in UI.
