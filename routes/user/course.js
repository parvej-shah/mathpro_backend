const { authenticateUser, optAuthenticateUser, authenticateAdmin } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const CourseController = require('../../controllers/user/course').CourseController
const AnnouncementController = require('../../controllers/user/announcement').AnnouncementController
const adminAuthMiddleWare = require('../../service/authMiddleWares').authenticateUser

const courseController = new CourseController()
const announcementController = new AnnouncementController()

router.route("/list").get(courseController.list);
router.route("/featured").get(courseController.featured);
router.route("/directory").get(courseController.directory);
router.route("/takes/:id").post(authenticateUser, courseController.takes);
router.route("/getfull/slug/:slug").get(optAuthenticateUser, courseController.getFullBySlug);
router.route("/getfull/:id").get(optAuthenticateUser, courseController.getFull);
router.route("/dashboard/:id").get(optAuthenticateUser, courseController.getDashboard);
router.route("/getScore/:id").get(optAuthenticateUser, courseController.getScore);
router.route("/getRanking/:id").get(authenticateUser, courseController.getRanking);
router.route("/prebook/:id").post(optAuthenticateUser, courseController.prebook);
router.route("/prebookBundle/:id").post(optAuthenticateUser, courseController.prebookBundle);
router.route("/getWishList").get(authenticateUser, courseController.getWishList);
router.route("/applyCoupon/:course_id").post(authenticateUser, courseController.applyCoupon);
router.route("/getAnalytics").get(authenticateAdmin, courseController.getAnalytics);
router.route("/getMyCoursesPage").get(authenticateUser, courseController.getMyCoursesPage);
router.route("/my-dashboard").get(authenticateUser, courseController.getMyDashboard);
router.route("/getMyCourses").get(authenticateUser, courseController.getMyCourses);
router.route("/getEnrolledCoursesByUserId").get(authenticateUser, courseController.getEnrolledCoursesByUserId);
router.route("/:courseId/routine").get(optAuthenticateUser, courseController.getRoutine);
router.route("/:courseId/announcements").get(optAuthenticateUser, announcementController.getAnnouncementsByCourse);

module.exports = router
