# Books Admin Management API Spec

This document defines the admin-side API contract for managing the new books system.

Scope:

- book catalogue management
- attaching books to courses
- viewing and updating physical book fulfillment orders
- permission requirements
- rollout fallback rules for admin permission checks

This is a backend contract document only. It does not include admin frontend code.

---

## Overview

The books system has three admin responsibilities:

- manage the central book catalogue
- attach or detach books from courses
- manage fulfillment status for purchased physical books

Important model rule:

- books are attached to courses only
- bundles inherit books from their courses automatically
- there is no direct bundle-to-book admin API

---

## Base Rules

- Base API URL: your backend host
- Admin base path: `/admin/book`
- Required auth header:

`Authorization: Bearer <admin_token>`

All endpoints in this document are protected admin endpoints.

---

## Permission Requirements

## 1. Backend-enforced permission

Current backend route protection uses:

- `book.manage.all`

This is enforced on all admin book routes.

Source of enforcement:

- `routes/managerial/book.js`
- `util/permissions.js`

Current permission constant values:

- `book.manage.all`
- `course.manage.all`

### Backend truth

For actual API access, the admin user must have:

- `book.manage.all`

Without that permission, the API will return `403`.

---

## 2. Frontend rollout fallback

For admin frontend permission gating during rollout:

- primary permission check should be `book.manage.all`
- fallback permission check may be `course.manage.all` if the frontend permission payload or menu config has not yet been updated to include book permissions

Recommended frontend visibility rule:

- show Books Management if user has `book.manage.all`
- if `book.manage.all` is unavailable in the permission payload/config, temporarily allow visibility when user has `course.manage.all`

Important limitation:

- this fallback is only for admin UI gating during rollout
- backend authorization still requires `book.manage.all`

### Rollout recommendation

For any admin role that should manage books, assign:

- `book.manage.all`

If your current admin permission mapping is still course-centric and book permission wiring is not yet deployed in the frontend, also ensure:

- `course.manage.all`

This allows temporary frontend access decisions while backend permission rollout is completed.

---

## Admin Responsibilities and API Groups

## 3. Book Catalogue Management

Used for:

- create a new physical book
- list all books
- read one book
- update a book
- delete a book

Fields managed in the catalogue:

- `title`
- `image_url`
- `description`
- `class_levels`
- `tags`
- `price`
- `is_active`

Notes:

- `price` uses BDT integer convention
- `class_levels` and `tags` are JSON fields
- inactive books are hidden from student inclusion flows

---

## 4. Course Book Attachment Management

Used for:

- see which books are attached to a course
- attach a book to a course
- detach a book from a course

Notes:

- attaching a book to a course makes it eligible for course checkout
- if that course belongs to a bundle, the bundle may expose that book automatically
- bundle books are derived, not managed separately

---

## 5. Fulfillment Order Management

Used for:

- list purchased physical book orders
- filter by fulfillment status
- update fulfillment status

Statuses:

- `pending`
- `shipped`
- `delivered`
- `cancelled`

These orders are created only after successful payment IPN processing.

---

## API Endpoints

## 6. List All Books

**GET** `/admin/book`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Purpose:

- returns the full catalogue for admin management

Success response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "title": "string",
      "image_url": "string|null",
      "description": "string|null",
      "class_levels": "array|json|null",
      "tags": "array|json|null",
      "price": "number",
      "is_active": "boolean",
      "created_by": "number|null",
      "created_at": "number|null",
      "updated_at": "number|null"
    }
  ]
}
```

Frontend usage:

- admin listing page
- filter/search client-side unless a dedicated backend filter is added later

---

## 7. Get One Book

**GET** `/admin/book/:id`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Path params:

- `id`
  - book ID

Success response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "title": "string",
      "image_url": "string|null",
      "description": "string|null",
      "class_levels": "array|json|null",
      "tags": "array|json|null",
      "price": "number",
      "is_active": "boolean",
      "created_by": "number|null",
      "created_at": "number|null",
      "updated_at": "number|null"
    }
  ]
}
```

Frontend usage:

- edit form prefill
- detail drawer/modal/page

---

## 8. Create Book

**POST** `/admin/book`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Request body:

```json
{
  "title": "string required",
  "image_url": "string optional",
  "description": "string optional",
  "class_levels": "array|json optional",
  "tags": "array|json optional",
  "price": "number required",
  "is_active": "boolean optional"
}
```

Request rules:

- `title` should be provided
- `price` should be a non-negative integer amount in BDT
- `class_levels` and `tags` may be arrays; backend stores them as JSON

Success response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "title": "string",
      "image_url": "string|null",
      "description": "string|null",
      "class_levels": "array|json|null",
      "tags": "array|json|null",
      "price": "number",
      "is_active": "boolean",
      "created_by": "number|null",
      "created_at": "number|null",
      "updated_at": "number|null"
    }
  ]
}
```

---

## 9. Update Book

**PUT** `/admin/book/:id`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Path params:

- `id`
  - book ID

Request body:

```json
{
  "title": "string required by current update behavior",
  "image_url": "string optional",
  "description": "string optional",
  "class_levels": "array|json optional",
  "tags": "array|json optional",
  "price": "number required by current update behavior",
  "is_active": "boolean optional"
}
```

Important implementation note:

- current update behavior writes the full managed field set
- admin frontend should send the complete editable book object, not a sparse patch

Success response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "title": "string",
      "image_url": "string|null",
      "description": "string|null",
      "class_levels": "array|json|null",
      "tags": "array|json|null",
      "price": "number",
      "is_active": "boolean",
      "created_by": "number|null",
      "created_at": "number|null",
      "updated_at": "number|null"
    }
  ]
}
```

---

## 10. Delete Book

**DELETE** `/admin/book/:id`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Path params:

- `id`
  - book ID

Success response shape:

```json
{
  "success": true
}
```

Deletion effect:

- removes the book from the catalogue
- removes any `course_book` link rows through database cascade

Frontend recommendation:

- confirm before delete
- avoid delete for books with historic business value unless product policy explicitly allows it

---

## 11. List Books Attached To A Course

**GET** `/admin/book/course/:courseId`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Path params:

- `courseId`
  - course ID

Purpose:

- fetch all books currently attached to a course

Success response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "title": "string",
      "image_url": "string|null",
      "description": "string|null",
      "class_levels": "array|json|null",
      "tags": "array|json|null",
      "price": "number",
      "is_active": "boolean"
    }
  ]
}
```

Frontend usage:

- course books tab
- attach/detach management screen

---

## 12. Attach A Book To A Course

**POST** `/admin/book/course/:courseId`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Path params:

- `courseId`
  - course ID

Request body:

```json
{
  "book_id": "number required"
}
```

Rules:

- attaching the same book again is safe
- backend uses conflict protection and does not create duplicates

Success response shape:

```json
{
  "success": true
}
```

Error example:

```json
{
  "success": false,
  "error": "book_id is required"
}
```

Effect:

- course now exposes this book in student course detail
- bundles containing this course may also expose this book automatically

---

## 13. Detach A Book From A Course

**DELETE** `/admin/book/course/:courseId/:bookId`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Path params:

- `courseId`
  - course ID
- `bookId`
  - book ID

Success response shape:

```json
{
  "success": true
}
```

Effect:

- removes the course-to-book association
- if no other course in a bundle provides that book, the bundle may stop exposing it

---

## 14. List Physical Book Orders

**GET** `/admin/book/orders`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Query params:

- `status`
  - optional
  - one of `pending`, `shipped`, `delivered`, `cancelled`

Purpose:

- returns physical book fulfillment rows created after successful payment

Success response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "user_id": "number",
      "course_id": "number|null",
      "bundle_id": "number|null",
      "book_id": "number",
      "amount_paid": "number|null",
      "transaction_id": "string|null",
      "ship_name": "string|null",
      "ship_phone": "string|null",
      "ship_address": "string|null",
      "ship_city": "string|null",
      "ship_postcode": "string|null",
      "fulfillment_status": "pending|shipped|delivered|cancelled",
      "timestamp": "number|null",
      "book_title": "string",
      "book_image_url": "string|null",
      "user_name": "string|null",
      "user_login": "string|null"
    }
  ]
}
```

Important meaning:

- each row represents one purchased book
- one transaction with three books creates three fulfillment rows

Frontend usage:

- orders table
- status filter
- shipping detail view

---

## 15. Update Fulfillment Status

**PUT** `/admin/book/orders/:id/status`

Auth:

- required admin auth

Permission:

- `book.manage.all`

Path params:

- `id`
  - fulfillment row ID

Request body:

```json
{
  "fulfillment_status": "pending|shipped|delivered|cancelled"
}
```

Allowed values:

- `pending`
- `shipped`
- `delivered`
- `cancelled`

Success response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "fulfillment_status": "pending|shipped|delivered|cancelled"
    }
  ]
}
```

Validation error example:

```json
{
  "success": false,
  "error": "fulfillment_status must be one of: pending, shipped, delivered, cancelled"
}
```

---

## Error and Auth Behavior

## 16. Unauthorized

If token is missing or invalid:

```json
{
  "success": false
}
```

Exact unauthorized body may vary by shared auth middleware behavior.

Expected HTTP status:

- `401`

---

## 17. Forbidden

If admin auth is valid but permission is missing:

```json
{
  "success": false,
  "error": "INSUFFICIENT_PERMISSIONS"
}
```

Exact forbidden body may vary by shared permission middleware behavior.

Expected HTTP status:

- `403`

---

## Admin Frontend Behavior Rules

## 18. Menu and route access

Recommended admin sections:

- `/admin/books`
- `/admin/books/new`
- `/admin/books/:id`
- `/admin/books/orders`
- `/admin/courses/:courseId/books`

Menu visibility rule:

- show if `book.manage.all`
- temporary rollout fallback: show if `course.manage.all` when `book.manage.all` is not yet available in permission payload/config

API call rule:

- actual API requests should only be expected to succeed when `book.manage.all` is granted server-side

---

## 19. Course integration rules

When managing books inside a course admin screen:

- fetch current attached books using `GET /admin/book/course/:courseId`
- attach using `POST /admin/book/course/:courseId`
- detach using `DELETE /admin/book/course/:courseId/:bookId`

Do not expect:

- direct bundle attach API
- course detail admin update endpoint to accept embedded book arrays

Book attachment is a separate API concern.

---

## 20. Fulfillment screen rules

For the admin orders page:

- treat each row as one purchased book
- group rows by `transaction_id` in the frontend only if you want an order-level view
- shipping fields are stored per row for operational convenience

Recommended admin filters:

- fulfillment status
- transaction ID
- user
- book title

Only `status` is currently supported by backend query params in this API group.

---

## Current Limitations

- no direct bundle-book management API
- no server-side pagination for book catalogue routes in this API group
- no server-side search/filter for catalogue routes in this API group
- no bulk attach/detach endpoint
- no bulk fulfillment status update endpoint
- no dedicated admin analytics endpoint for books in this API group

---

## Rollout Summary

### Required backend permission for real API usage

- `book.manage.all`

### Temporary frontend fallback for visibility if book permission wiring is missing

- `course.manage.all`

### Recommended role assignment for admins who should manage books

- assign `book.manage.all`
- if permission rollout is still incomplete in frontend config, also assign `course.manage.all`

