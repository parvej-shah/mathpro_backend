# Feature: course-bundle — Purpose

## Domain

Owns the core content/catalog contract: courses and bundles. Courses can be published
(`is_live`) or unpublished, tagged by category (e.g. Class 8/SSC/HSC), purchased
individually or as part of a bundle. Bundles package multiple courses for sale — the
Frontend displays them as "Combo" (display-only; this repo keeps `bundle`).

## Routes / Controllers / Services

**User-facing** (`routes/user/course.js`, `routes/user/bundle.js`):
- `GET /user/course/list` — all live courses (flat)
- `GET /user/course/directory` — live courses grouped by category
- `GET /user/course/featured` — featured courses
- `GET /user/course/getfull/:id` / `getfull/slug/:slug` — course detail (by id or slug)
- `GET /user/course/dashboard/:id`, `getScore/:id`, `getRanking/:id`, `getAnalytics`
- `POST /user/course/takes/:id` — enroll
- `POST /user/course/applyCoupon/:course_id`
- `GET /user/course/getMyCourses`, `getMyCoursesPage`, `my-dashboard`
- `GET /user/bundle/` — all bundles (public); `GET /user/bundle/:id` / `slug/:slug` — detail
- `GET /user/bundle/my-bundles`, `bundle-courses`, `all-courses`
- `GET /user/bundle/:id/check-purchase/:user_id`, `/check-prebook/:user_id`,
  `/check-duplicates/:user_id`

**Admin** (`routes/managerial/course.js`, `routes/managerial/bundle.js`):
- Full CRUD for courses/bundles (requires `course.manage.all` / equivalent permission).
- Bulk import/export via `service/managerial/courseImportExport.js`.
- Course V2 versioning routes (`courseV2.js`, `service/managerial/courseV2.js`,
  `service/managerial/moduleV2.js`) — a parallel implementation, don't delete V1 when
  touching V2.

**Controllers:** `controllers/user/course.js` (`CourseController`, also delegates to
`FeaturedCourseService`, `RoutineService`), `controllers/user/bundle.js`
(`UserBundleController`), `controllers/managerial/{course,bundle}.js`.

**Services:** `service/managerial/course.js` (`CourseService` — table `course`, columns
include `title`, `price`, `x_price`, `enrolled`, `is_live`, `slug`, `total_seats`, `tags`,
`course_outline`, `chips`, `you_get`, `instructor_list`, `faq_list`),
`service/managerial/bundle.js` (`BundleService` — table `bundle`),
`service/managerial/featuredCourse.js`, `service/managerial/courseImportExport.js`.

## Reference docs

- `docs/COURSE_DIRECTORY_API_SPEC.md` — directory endpoint, category grouping, slug routing.
- `docs/DASHBOARD_MY_COURSES_API_SPEC.md` — enrolled-user dashboard shape.
- `docs/BOOKS_COURSE_BUNDLE_PAYMENT_FRONTEND_SPEC.md` — books attached to courses, bundle
  payment flow.
- `docs/frontend-guide-user.md` — response shape conventions (chips, slug, tags).
- `docs/managerial_course/` — admin-specific guides.
