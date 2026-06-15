# Feature: course-bundle — Rules & Guardrails

Inherits all of `invariants.md` and `conventions.md`. Invariants always win.

## Contract stability

- `course` and `bundle` response shapes (`chips`, `you_get`, `faq_list`, `feedback_list`,
  `instructor_list`, `tags`, `slug`, `course_outline`) are consumed by **both** clients —
  changing a field name or nesting is a breaking change. Prefer adding new fields;
  enumerate Frontend + Admin updates if a rename/removal is unavoidable.
- `slug`-based routing (`getfull/slug/:slug`) is additive alongside `id`-based routing
  (`getfull/:id`) — don't remove the `:id` route while clients still use it.
- `is_live` gates whether a course/bundle is visible to students. `tags` drive
  category/directory grouping (`directory` endpoint) — changing tag semantics affects the
  Frontend's category filter UI.

## V1 / V2 coexistence

- `course.js`/`module.js` (V1) and `courseV2.js`/`moduleV2.js` (V2) are parallel
  implementations under `routes/managerial/`, `controllers/managerial/`,
  `service/managerial/`. Check which version a route belongs to before editing — don't
  port a V1 fix into V2 (or vice versa) without checking both are meant to share it.

## Bundle <-> course relationship

- Bundle-course membership and access checks (`check-purchase`, `check-prebook`,
  `check-duplicates`) live in `BundleService` — don't duplicate access logic in
  `CourseService` or controllers.
- `bundle` vocabulary stays as-is here (`invariants.md` § API Contract / Vocabulary).

## Coupons & payments

- `applyCoupon` and bundle purchase flows interact with `service/managerial/coupon.js` +
  the `Coupon*` security/audit services and `service/user/payment.js` /
  `service/managerial/revenueService.js`. Changes to price/discount calculation in
  course-bundle code that affect payment totals are cross-cutting — flag them.
