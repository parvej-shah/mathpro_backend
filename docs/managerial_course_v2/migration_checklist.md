# Course V2 Migration Checklist

This checklist tracks the work required before deleting the legacy course stack:

- `routes/managerial/course.js`
- `controllers/managerial/course.js`
- `service/managerial/course.js`

Deletion is only safe after all legacy admin routes are replaced, all non-route consumers are migrated, and `CourseServiceV2` no longer extends `CourseService`.

## Current State

Legacy admin course routes are still mounted at `/admin/course` in `app.js`.

V2 routes are mounted separately at `/v2/admin/course` and currently cover only:

- `GET /:courseId/getFull-enhanced`
- `PUT /:courseId/modules/reorder`
- `GET /:courseId/export`
- `POST /import`
- `GET /import/:importId/status`
- `GET /import/template`

## Blockers

These are the hard blockers that prevent deleting the legacy service today:

- `service/managerial/courseV2.js` extends `CourseService`
- `service/managerial/courseImportExport.js` extends `CourseServiceV2`, which still inherits legacy behavior
- User course flows still import `service/managerial/course.js`
- Revenue flows still import `service/managerial/course.js`
- Payment enrollment still imports `service/managerial/course.js`
- Level service still imports `service/managerial/course.js` for score lookup
- Swagger components still instantiate `CourseService`

## Legacy Admin Endpoints To Migrate

These routes exist in `routes/managerial/course.js` and do not yet exist in V2:

- `GET /admin/course/list`
- `GET /admin/course/get/:id`
- `GET /admin/course/getfull/:id`
- `POST /admin/course/create`
- `PUT /admin/course/update/:id`
- `PUT /admin/course/updateFull/:id`
- `DELETE /admin/course/delete/:id`
- `GET /admin/course/getRevenue/:id`
- `GET /admin/course/getAllRevenue`
- `GET /admin/course/getAllCoursePerchases`
- `GET /admin/course/getAllCoursePerchasesApi`
- `GET /admin/course/getAllPrebookings`
- `GET /admin/course/getAllPrebookingsApi`
- `PUT /admin/course/prebooking/:prebookingId/utm`
- `DELETE /admin/course/prebooking/:prebookingId/utm`
- `GET /admin/course/getUserProgress/:id/:user_id`

## Legacy Service Methods In Active Use

### Admin course controller

`controllers/managerial/course.js` currently depends on:

- `list`
- `create`
- `update`
- `updateFull`
- `get`
- `getFull`
- `deleteEntry`
- `getRevenue`
- `getAllRevenue`
- `getUserProgress`

### User course controller

`controllers/user/course.js` currently depends on:

- `listForUser`
- `takes`
- `getFullUser`
- `getScore`
- `getRanking`
- `prebook`
- `prebookBundle`
- `getWishList`
- `applyCoupon`
- `getAnalytics`
- `getMyCoursesPage`
- `getMyCourses`
- `getEnrolledCoursesByUserId`
- `getDashboard`

### Other direct consumers

- `controllers/managerial/revenueController.js`
  - `getDetailedRevenue`
  - `getRevenueByTimeframe`
  - `getTopRevenueGenerators`
- `controllers/user/payment.js`
  - `takes`
  - `createLog`
- `service/user/payment.js`
  - `takes`
- `service/managerial/level.js`
  - `getScore`
- `docs/components.js`
  - reads `cols` and `types`

## Recommended Migration Order

### Phase 1: Break V2 inheritance from legacy

- Create a standalone base for V2 course reads and writes
- Move shared primitives from `CourseService` into `CourseServiceV2`
  - `table`, `pk`, `cols`, `types`
  - `getColumns`
  - `getWildCards`
  - `getUpdatePairs`
  - `create`
  - `update`
  - `get`
- Remove `extends CourseService` from `CourseServiceV2`
- Make `CourseImportExportService` depend only on V2-native behavior

Exit criteria:

- `service/managerial/courseV2.js` no longer imports `./course`
- import/export and reorder still work

### Phase 2: Migrate admin read/write endpoints into V2

Add V2 equivalents for the basic admin course CRUD endpoints:

- `GET /v2/admin/course`
- `GET /v2/admin/course/:courseId`
- `GET /v2/admin/course/:courseId/full`
- `POST /v2/admin/course`
- `PUT /v2/admin/course/:courseId`
- `PUT /v2/admin/course/:courseId/full`
- `DELETE /v2/admin/course/:courseId`
- `GET /v2/admin/course/:courseId/user-progress/:userId`

Status:

- implemented in backend routes/controllers/services
- documented in `docs/managerial_course_v2`
- still pending caller cutover from legacy `/admin/course/...`
- no internal `/admin/course/...` callers were found in this backend repo; remaining callers are likely external clients or a separate frontend/admin app

Implementation tasks:

- move or rewrite `list`
- move or rewrite `get`
- decide whether `getFull` is replaced by `getFull-enhanced` or both are needed
- move or rewrite `create`
- move or rewrite `update`
- replace `updateFull` with a clearer V2 contract if possible
- move or rewrite `deleteEntry`
- move or rewrite `getUserProgress`

Exit criteria:

- frontend/admin clients can stop calling `/admin/course/list`
- frontend/admin clients can stop calling `/admin/course/get/:id`
- frontend/admin clients can stop calling `/admin/course/getfull/:id`
- frontend/admin clients can stop calling `/admin/course/create`
- frontend/admin clients can stop calling `/admin/course/update/:id`
- frontend/admin clients can stop calling `/admin/course/updateFull/:id`
- frontend/admin clients can stop calling `/admin/course/delete/:id`
- frontend/admin clients can stop calling `/admin/course/getUserProgress/:id/:user_id`

### Phase 3: Migrate admin operational endpoints

Move the remaining admin-only operational flows:

- revenue summary endpoints
- purchases and prebookings exports/APIs
- prebooking UTM update/delete

Implementation tasks:

- either move revenue methods into `CourseServiceV2` or keep them under `revenueController` with a dedicated revenue service
- extract prebooking and purchase reporting into a dedicated service if possible

Recommended target split:

- course CRUD and hierarchy stays in `CourseServiceV2`
- revenue moves to a dedicated revenue service
- prebooking and purchase reporting moves to a reporting service

Exit criteria:

- no admin code depends on `controllers/managerial/course.js`
- no admin route depends on `routes/managerial/course.js`

### Phase 4: Remove user-facing dependency on legacy managerial course service

Right now user course routes are implemented through the managerial course service. That coupling should be removed before deleting legacy code.

Implementation tasks:

- create a user-focused course service, or split read-only user behavior into its own service
- migrate these methods out of `service/managerial/course.js`:
  - `listForUser`
  - `getFullUser`
  - `getDashboard`
  - `getScore`
  - `getRanking`
  - `prebook`
  - `prebookBundle`
  - `getWishList`
  - `applyCoupon`
  - `getAnalytics`
  - `getMyCoursesPage`
  - `getMyCourses`
  - `getEnrolledCoursesByUserId`
- decide whether `takes` belongs in payment/enrollment instead of course

Exit criteria:

- `controllers/user/course.js` no longer imports `service/managerial/course.js`

### Phase 5: Remove remaining cross-domain dependencies

Implementation tasks:

- move enrollment write logic out of `CourseService.takes`
  - likely into payment or enrollment service
- move `createLog` to a dedicated logging/audit utility
- replace `LevelService -> courseService.getScore` dependency with a score/progress helper
- remove swagger schema generation dependency on runtime `CourseService`
  - define static schema metadata instead of reading `cols` and `types`

Exit criteria:

- `controllers/user/payment.js` no longer imports legacy course service
- `service/user/payment.js` no longer imports legacy course service
- `service/managerial/level.js` no longer imports legacy course service
- `docs/components.js` no longer imports legacy course service

### Phase 6: Cutover and delete legacy files

Only after all previous phases are complete:

- stop mounting `/admin/course` in `app.js`
- remove legacy docs under `docs/managerial_course` if fully superseded
- delete:
  - `routes/managerial/course.js`
  - `controllers/managerial/course.js`
  - `service/managerial/course.js`

Exit criteria:

- `rg "service/managerial/course"` returns no runtime imports
- `rg "routes/managerial/course"` returns no active app imports
- `rg "controllers/managerial/course"` returns no active app imports
- tests for admin course, user course, payment enrollment, and revenue pass

## Suggested First PR

The lowest-risk first PR is:

- make `CourseServiceV2` standalone
- copy only the shared CRUD metadata/helpers it needs from legacy
- keep route behavior unchanged
- do not delete anything yet

That gives us a clean foundation for the next PRs without breaking existing admin or user flows.
