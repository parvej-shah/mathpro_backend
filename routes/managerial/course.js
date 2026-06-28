const router = require("express-promise-router")();
const CourseController =
  require("../../controllers/managerial/course").CourseController;
const { requirePermission, requireCourseAccess } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const { revalidateOnWrite } = require("../../util/revalidateFrontend");

const courseController = new CourseController();

// A course write can change the catalog and any combo that contains it.
// (This is the deprecated v1 router; the v2 router carries the same hook.)
router.use(revalidateOnWrite(["courses", "combos"]));

const requireCourseManage = requirePermission(PERMISSIONS.COURSE.MANAGE.ALL);
const requireRevenueAccess = requirePermission(PERMISSIONS.COURSE.MANAGE.ALL);
const requireCourseManageAccess = requireCourseAccess('course', 'manage', (req) => req.params.id);

router.use((req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Tue, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('Link', '</v2/admin/course>; rel="successor-version"');
  res.setHeader('X-Deprecated-Endpoint', 'Use /v2/admin/course routes instead');
  next();
});

router.route("/list").get(requireCourseManage, courseController.list);
router.route("/get/:id").get(requireCourseManage, courseController.getEntry);
router.route("/getfull/:id").get(requireCourseManage, courseController.getFull);
router.route("/create").post(requireCourseManage, courseController.create);
router.route("/update/:id").put(requireCourseManageAccess, courseController.update);
router
  .route("/updateFull/:id")
  .put(requireCourseManageAccess, courseController.updateFull);
router
  .route("/delete/:id")
  .delete(requireCourseManageAccess, courseController.deleteEntry);
router
  .route("/getRevenue/:id")
  .get(requireRevenueAccess, courseController.getRevenue);
router
  .route("/getAllRevenue")
  .get(requireRevenueAccess, courseController.getAllRevenue);
router
  .route("/getAllCoursePerchases")
  .get(requireCourseManage, courseController.getAllCoursePerchases);
router
  .route("/getAllCoursePerchasesApi")
  .get(requireCourseManage, courseController.getAllCoursePerchasesApi);
router
  .route("/getAllPrebookings")
  .get(requireCourseManage, courseController.getAllPrebookings);
router
  .route("/getAllPrebookingsApi")
  .get(requireCourseManage, courseController.getAllPrebookingsApi);
router
  .route("/prebooking/:prebookingId/utm")
  .put(requireCourseManage, courseController.updatePrebookingUtm);
router
  .route("/prebooking/:prebookingId/utm")
  .delete(requireCourseManage, courseController.deletePrebookingUtm);
router
  .route("/getUserProgress/:id/:user_id")
  .get(requireCourseManage, courseController.getUserProgress);

module.exports = router;
