const { authenticateUser, optAuthenticateUser, authenticateAdmin } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const CourseController = require('../../controllers/user/course').CourseController
const AnnouncementController = require('../../controllers/user/announcement').AnnouncementController
const adminAuthMiddleWare = require('../../service/authMiddleWares').authenticateUser
const { actorLimiter, ipLimiter } = require("../../util/rateLimitPolicies");

const courseController = new CourseController()
const announcementController = new AnnouncementController()

const publicCourseReadLimit = ipLimiter(
  "course:public-read",
  60,
  15 * 60 * 1000,
  { message: "Too many course requests. Please try again later." }
);

const authenticatedCourseReadLimit = actorLimiter(
  "course:authenticated-read",
  30,
  15 * 60 * 1000,
  { message: "Too many course requests. Please try again later." }
);

const courseWriteLimit = actorLimiter(
  "course:write",
  10,
  15 * 60 * 1000,
  { message: "Too many course actions. Please try again later." }
);

const courseAnalyticsLimit = actorLimiter(
  "course:analytics",
  10,
  15 * 60 * 1000,
  { message: "Too many analytics requests. Please try again later." }
);

router.route("/list").get(publicCourseReadLimit, courseController.list);
router.route("/featured").get(publicCourseReadLimit, courseController.featured);
router.route("/directory").get(publicCourseReadLimit, courseController.directory);
router.route("/takes/:id").post(authenticateUser, courseWriteLimit, courseController.takes);
router.route("/getfull/slug/:slug").get(optAuthenticateUser, authenticatedCourseReadLimit, courseController.getFullBySlug);
router.route("/getfull/:id").get(optAuthenticateUser, authenticatedCourseReadLimit, courseController.getFull);
router.route("/dashboard/:id").get(optAuthenticateUser, authenticatedCourseReadLimit, courseController.getDashboard);
router.route("/getScore/:id").get(optAuthenticateUser, authenticatedCourseReadLimit, courseController.getScore);
router.route("/getRanking/:id").get(authenticateUser, authenticatedCourseReadLimit, courseController.getRanking);
router.route("/prebook/:id").post(optAuthenticateUser, courseWriteLimit, courseController.prebook);
router.route("/prebookBundle/:id").post(optAuthenticateUser, courseWriteLimit, courseController.prebookBundle);
router.route("/getWishList").get(authenticateUser, authenticatedCourseReadLimit, courseController.getWishList);
router.route("/applyCoupon/:course_id").post(authenticateUser, courseWriteLimit, courseController.applyCoupon);
router.route("/getAnalytics").get(authenticateAdmin, courseAnalyticsLimit, courseController.getAnalytics);
router.route("/getMyCoursesPage").get(authenticateUser, authenticatedCourseReadLimit, courseController.getMyCoursesPage);
router.route("/my-dashboard").get(authenticateUser, authenticatedCourseReadLimit, courseController.getMyDashboard);
router.route("/getMyCourses").get(authenticateUser, authenticatedCourseReadLimit, courseController.getMyCourses);
router.route("/getEnrolledCoursesByUserId").get(authenticateUser, authenticatedCourseReadLimit, courseController.getEnrolledCoursesByUserId);
router.route("/:courseId/routine").get(optAuthenticateUser, publicCourseReadLimit, courseController.getRoutine);
router.route("/:courseId/announcements").get(optAuthenticateUser, publicCourseReadLimit, announcementController.getAnnouncementsByCourse);

module.exports = router
