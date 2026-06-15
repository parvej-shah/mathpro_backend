# Books With Course/Bundle Payment API Spec

This document defines the frontend API contract for:

- reading books attached to a course
- reading books available through a bundle
- initiating payment for course or bundle purchases with optional books
- understanding pricing and post-payment behavior

This is a backend contract document only. It does not define UI or frontend code.

---

## Base Rules

- Base API URL: your backend host
- Auth for payment initiation:
  - `Authorization: Bearer <user_token>`
- Currency:
  - `BDT`
- Payment gateway:
  - `SSLCommerz`

---

## Book Inclusion Model

### 1. Course books

Books are attached directly to courses.

Returned in course detail response as:

- `attached_books`
- `books_total`

### 2. Bundle books

Books are not attached directly to bundles.

A bundle exposes books as the distinct union of books attached to all courses inside that bundle.

Returned in bundle detail response as:

- `attached_books`
- `books_total`

### 3. Selection behavior

The current backend behavior is all-or-nothing.

- If `include_books` is `false` or omitted:
  - no books are added to the payment
- If `include_books` is `true`:
  - all available attached books for that course are included
  - or all distinct available books across that bundle are included

Per-book selection is not supported by the current API.

### 4. Coupon behavior

Coupons apply only to the base course or base bundle price.

Coupons do not discount book prices.

Final amount calculation:

- `final_payable = discounted_course_or_bundle_price + books_total`

or, if no coupon:

- `final_payable = base_course_or_bundle_price + books_total`

---

## Read APIs

## 1. Get Course Detail

**GET** `/user/course/getfull/:id`

Auth:

- optional user auth

Purpose:

- returns course detail
- returns whether the user already has access
- returns books available to include with this course

Relevant response fields:

```json
{
  "success": true,
  "isTaken": "boolean",
  "isWishList": "boolean",
  "id": "number",
  "title": "string",
  "price": "number",
  "attached_books": [
    {
      "id": "number",
      "title": "string",
      "image_url": "string|null",
      "price": "number",
      "class_levels": "array|json|null",
      "tags": "array|json|null",
      "description": "string|null"
    }
  ],
  "books_total": "number"
}
```

Frontend usage rules:

- If `attached_books.length === 0`, do not offer book inclusion for this course.
- If `attached_books.length > 0`, frontend may offer optional inclusion of all books.
- `books_total` is informational only. Backend recalculates authoritative price during payment initiation.

---

## 2. Get Bundle Detail

**GET** `/user/bundle/:id`

**GET** `/user/bundle/slug/:slug`

Auth:

- optional user auth

Purpose:

- returns bundle detail by numeric id or by slug (`bundle.url`)
- returns books available to include with this bundle

Relevant response fields:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "title": "string",
      "price": "number",
      "attached_books": [
        {
          "id": "number",
          "title": "string",
          "image_url": "string|null",
          "price": "number",
          "class_levels": "array|json|null",
          "tags": "array|json|null",
          "description": "string|null"
        }
      ],
      "books_total": "number"
    }
  ]
}
```

Frontend usage rules:

- `attached_books` is the distinct union across bundle courses.
- If `attached_books.length === 0`, do not offer book inclusion for this bundle.
- `books_total` is informational only. Backend recalculates authoritative price during payment initiation.

---

## Payment Initiation APIs

## 3. Initiate Course Payment

**POST** `/user/payment/initiate/:id`

Auth:

- required

Path params:

- `id`
  - course ID

Request body:

```json
{
  "user_id": "number",
  "coupon_code": "string optional",
  "include_books": "boolean optional",
  "shipping": {
    "name": "string required when include_books=true",
    "phone": "string required when include_books=true",
    "address": "string required when include_books=true",
    "city": "string optional",
    "postcode": "string optional"
  }
}
```

Request rules:

- `user_id` must be the authenticated user.
- If `include_books` is `true`, `shipping.name`, `shipping.phone`, and `shipping.address` are required.
- If `include_books` is `false` or omitted, `shipping` is ignored.

Success response:

```json
{
  "success": true,
  "data": "string",
  "coupon_applied": "boolean",
  "original_price": "number",
  "final_price": "number",
  "discount_amount": "number",
  "books_included": "boolean",
  "books_total": "number"
}
```

Success response rules:

- `data`
  - SSLCommerz gateway URL
- `original_price`
  - base course price before coupon and before books
- `discount_amount`
  - discount amount applied only to course price
- `books_total`
  - total of all attached included books
- `final_price`
  - amount sent to payment gateway

Error response examples:

```json
{
  "success": false,
  "error": "Invalid coupon code"
}
```

```json
{
  "success": false,
  "error": "Shipping name, phone and address are required when including books"
}
```

```json
{
  "success": false,
  "error": "No books are available to include for this item"
}
```

---

## 4. Initiate Bundle Payment

**POST** `/user/payment/initiate-for-bundle/:id`

Auth:

- required

Path params:

- `id`
  - bundle ID

Request body:

```json
{
  "user_id": "number",
  "coupon_code": "string optional",
  "include_books": "boolean optional",
  "shipping": {
    "name": "string required when include_books=true",
    "phone": "string required when include_books=true",
    "address": "string required when include_books=true",
    "city": "string optional",
    "postcode": "string optional"
  }
}
```

Request rules:

- `user_id` must be the authenticated user.
- If `include_books` is `true`, `shipping.name`, `shipping.phone`, and `shipping.address` are required.
- If `include_books` is `false` or omitted, `shipping` is ignored.

Success response:

```json
{
  "success": true,
  "data": "string",
  "coupon_applied": "boolean",
  "original_price": "number",
  "final_price": "number",
  "discount_amount": "number",
  "books_included": "boolean",
  "books_total": "number"
}
```

Success response rules:

- `data`
  - SSLCommerz gateway URL
- `original_price`
  - base bundle price before coupon and before books
- `discount_amount`
  - discount amount applied only to bundle price
- `books_total`
  - total of all distinct included bundle books
- `final_price`
  - amount sent to payment gateway

Error response examples are the same as course payment initiation.

---

## Gateway Address Behavior

When `include_books = true`, the backend now sends the submitted shipping object into the SSLCommerz payload.

Fields mapped to gateway shipping data:

- `shipping.name`
- `shipping.phone`
- `shipping.address`
- `shipping.city`
- `shipping.postcode`

Behavior:

- physical-book checkout uses the submitted shipping address
- non-book checkout falls back to backend defaults for gateway address fields

Frontend requirement:

- frontend must send the complete shipping object whenever `include_books = true`

---

## Post-Payment Behavior

## 5. Gateway Success Redirect

Backend callback:

- **POST** `/user/payment/success`

Frontend-visible redirect result:

- for course:
  - `/post-payment/success?type=course&courseId=:id`
- for bundle:
  - `/post-payment/success?type=bundle&bundleId=:id`

Frontend rule:

- success page should not assume payment completion solely from redirect timing
- actual enrollment and book fulfillment are finalized by IPN processing

---

## 6. Gateway Failure Redirect

Backend callback:

- **POST** `/user/payment/failure`

Frontend-visible redirect result:

- `/post-payment/failure`

---

## 7. Gateway Cancel Redirect

Backend callback:

- **POST** `/user/payment/cancel`

Frontend-visible redirect result:

- `/post-payment/cancel`

---

## IPN Processing Effects

Frontend does not call IPN directly.

Backend IPN endpoint:

- **POST** `/user/payment/ipn`

On successful validated payment:

### Course purchase

- inserts course access into `takes`
- marks coupon usage as completed if applicable
- converts staged book selection into confirmed `course_book_purchase` rows

### Bundle purchase

- inserts bundle purchase into `bundle_purchase`
- grants bundle course access into `takes`
- marks coupon usage as completed if applicable
- converts staged book selection into confirmed `course_book_purchase` rows

---

## Frontend Decision Rules

## 8. When to show the books option

Show book inclusion option only if:

- course or bundle detail response has `attached_books.length > 0`

Hide or disable the option if:

- `attached_books` is empty
- user already owns the course or bundle and repurchase is not allowed by product rules

---

## 9. When shipping fields are required

Require shipping fields only if:

- `include_books = true`

Minimum required fields:

- `name`
- `phone`
- `address`

Optional fields:

- `city`
- `postcode`

---

## 10. Pricing rules for frontend display

Frontend may display:

- base price from course or bundle detail
- coupon-adjusted price from payment initiation response
- books add-on total from detail response or initiation response
- final payable from payment initiation response

Backend remains authoritative for:

- coupon validity
- books availability
- books total
- final payable amount

Frontend must not compute final payable as a trusted source for transaction processing.

---

## Example State Meanings

### Course detail state

```json
{
  "attached_books": [
    { "id": 11, "title": "Book A", "price": 300 },
    { "id": 12, "title": "Book B", "price": 450 }
  ],
  "books_total": 750
}
```

Meaning:

- this course supports optional inclusion of both books together
- if the user checks include books, backend adds `750` BDT to the course payable amount

### Bundle detail state

```json
{
  "attached_books": [
    { "id": 21, "title": "Bundle Book 1", "price": 350 },
    { "id": 22, "title": "Bundle Book 2", "price": 400 }
  ],
  "books_total": 750
}
```

Meaning:

- this bundle supports optional inclusion of all distinct available books from its courses
- if the user checks include books, backend adds `750` BDT to the bundle payable amount

---

## Current API Limitations

- no per-book selection
- no quantity selection
- no separate bundle-book attachment table
- no standalone API to validate shipping before payment initiation
- no dedicated frontend polling/status API in this spec for payment completion

---

## Recommended Frontend Contract Summary

### For course purchase

1. Call `GET /user/course/getfull/:id`
2. Read `attached_books` and `books_total`
3. If user opts in, collect required shipping fields
4. Call `POST /user/payment/initiate/:id`
5. Redirect user to the returned SSLCommerz URL

### For bundle purchase

1. Call `GET /user/bundle/:id`
2. Read `attached_books` and `books_total`
3. If user opts in, collect required shipping fields
4. Call `POST /user/payment/initiate-for-bundle/:id`
5. Redirect user to the returned SSLCommerz URL
