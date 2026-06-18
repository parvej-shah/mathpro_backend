# Backend Rate Limiting Guide

This document describes the rate-limiting policy currently enforced in the backend.
It is the reference for future route changes in this repo.

## Goals

- Slow down brute-force, scraping, spam, and cost-amplification traffic.
- Keep normal student and admin workflows usable.
- Use route-local limits so each hotspot can have its own policy.
- Treat the current limiter as phase 1: in-memory, single-process, best effort.

## Shared Limiter Design

- The limiter implementation lives in `util/rateLimiter.js`.
- Route helpers for IP, user, and identifier-based policies live in
  `util/rateLimitPolicies.js`.
- The key includes a logical scope plus an actor key, so different endpoints do not
  share the same bucket.
- The current implementation is process-local. If the backend runs multiple instances,
  a Redis or gateway-backed limiter will be needed later.

## Current Enforcement Map

### Auth

- `POST /admin/auth/request-otp` - 5 per 15 min per identifier + IP
- `POST /admin/auth/verify-otp` - 5 per 15 min per identifier + IP
- `POST /admin/auth/register` - 5 per 15 min per identifier + IP
- `POST /admin/auth/login` - 8 per 15 min per identifier + IP
- `POST /admin/auth/google` - 10 per 15 min per IP
- `POST /admin/auth/forgot-password` - 5 per 15 min per identifier + IP
- `POST /admin/auth/reset-password` - 5 per 15 min per identifier + IP
- `POST /admin/auth/link-phone` - 20 per 15 min per user + IP
- `POST /admin/auth/connect-google` - 20 per 15 min per user + IP
- `POST /admin/auth/logout` - 20 per 15 min per user + IP
- `GET /admin/auth/sessions` - 20 per 15 min per user + IP
- `GET /admin/auth/getProfile` - 20 per 15 min per user + IP
- `PUT /admin/auth/setProfile` - 20 per 15 min per user + IP

### Payments

- `POST /user/payment/initiate/:id` - 5 per 15 min per user + IP
- `POST /user/payment/initiate-for-bundle/:id` - 5 per 15 min per user + IP
- `POST /user/payment/success` - 30 per 15 min per IP
- `POST /user/payment/failure` - 30 per 15 min per IP
- `POST /user/payment/cancel` - 30 per 15 min per IP
- `POST /user/payment/ipn` - 120 per 15 min per IP
- `GET /user/payment/history` - 20 per 15 min per user + IP
- `GET|POST /user/payment/audit-logs` - 10 per 15 min per user + IP
- `GET /admin/payment/audit-logs` - 20 per 15 min per admin user + IP
- `POST /admin/payment/reconcile` - 5 per hour per admin user + IP
- `GET /admin/payment/audit-logs/export` - 5 per hour per admin user + IP

### Uploads

- `POST /v2/user/upload/presigned-url` - 15 per hour per user + IP
- `POST /v2/admin/upload/presigned-url` - 20 per hour per admin user + IP
- `POST /v2/admin/upload/delete` - 10 per hour per admin user + IP

### Coupon Abuse

- `POST /user/coupon/validate` - 10 per 15 min per user or IP
- `POST /user/coupon/apply` - 10 per 15 min per user or IP
- `GET /user/coupon/course/:course_id` - 60 per 15 min per IP
- `GET /user/coupon/check-applicability` - 60 per 15 min per IP
- Admin coupon CRUD and analytics endpoints use separate read/write caps:
  - read-heavy endpoints: 20 per 15 min per admin user + IP
  - write-heavy endpoints: 10 per 15 min per admin user + IP

### Public Reads

- `GET /user/course/list`, `/featured`, `/directory` - 60 per 15 min per IP
- `GET /user/course/getfull/*`, `/dashboard/*`, `/getScore/*`, `/getWishList`,
  `/getMyCourses*`, `/routine`, `/announcements` - 30 per 15 min per user or IP
- `GET /user/instructor/list` - 30 per 15 min per IP
- `GET /user/faq/list` - 30 per 15 min per IP
- `GET /user/testimonial/list` - 30 per 15 min per IP

### Feedback / Module Activity

- `POST|PUT|DELETE /user/feedback/*` - 10 per 15 min per user + IP
- `GET /user/feedback/*` - 60 per 15 min per IP
- `POST /user/module-feedback` - 10 per 15 min per user + IP
- `GET /user/module-feedback/*` - 30 per 15 min per user + IP
- `POST /user/module/addProgress/:id` - 10 per 15 min per user + IP
- `GET /user/module/quiz/:id/attempt` - 30 per 15 min per user + IP
- `POST /user/module/quiz/:id/submit` - 10 per 15 min per user + IP
- `POST /user/module/recordView` - 10 per 15 min per user + IP
- `GET /user/module/recentViews/*`, `/mostRecent/*` - 30 per 15 min per user + IP

### Streaks

- `POST /user/streak/complete-lesson` - 30 per 15 min per user + IP
- `GET /user/streak/course/:courseId` - 60 per 15 min per user + IP
- `GET /user/streak/dashboard` - 60 per 15 min per user + IP
- `GET /user/streak/leaderboard/:courseId` - 30 per 15 min per user + IP
- Admin streak analytics, user detail, leaderboard, trends - capped separately with
  lower limits for bulk/admin correction routes.

### Admin Analytics / Reporting

- `GET /admin/analytics/*` dashboard and user/coupon read endpoints - 20 per 15 min
  per admin user + IP
- Heavy revenue/payment/detailed endpoints - 10 per 15 min per admin user + IP
- Metadata/export-oriented reads - 5 per hour per admin user + IP
- `GET /admin/feedback/*` and `GET /admin/module-feedback/*` use read caps; export and
  mutation routes use tighter write caps.

## How To Add A New Hotspot

1. Decide whether the route is public, authenticated, or admin-only.
2. Choose the limiter key type:
   - IP-only for anonymous scraping or callback routes
   - user + IP for authenticated writes
   - identifier + IP for login, OTP, and coupon-style abuse
3. Pick the narrowest logical scope that matches the route.
4. Keep read endpoints more permissive than write endpoints.
5. If the route can trigger cost or fraud, prefer a stricter default and document it here.

## Notes

- Existing business rules still matter. Example: OTP resend cooldowns and attempt caps
  remain enforced in auth service logic.
- The shared limiter is best effort only. It reduces abuse but does not replace gateway,
  CDN, or WAF controls.
- Keep this document updated when new high-risk routes are added.
