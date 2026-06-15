const {
  authenticateUser,
  optAuthenticateUser,
} = require("../../service/authMiddleWares");
const router = require("express-promise-router")();
const { UserBundleController } = require("../../controllers/user/bundle");

const bundleController = new UserBundleController();

// Public bundle endpoints
router.route("/").get(bundleController.list);
router.route("/slug/:slug").get(optAuthenticateUser, bundleController.getBySlug);
router.route("/:id").get(optAuthenticateUser, bundleController.get);

// Authenticated user endpoints with URL parameters
router
  .route("/my-bundles/:user_id")
  .get(authenticateUser, bundleController.getMyBundles);
router
  .route("/bundle-courses/:user_id")
  .get(authenticateUser, bundleController.getBundleCourses);
router
  .route("/all-courses/:user_id")
  .get(authenticateUser, bundleController.getAllCourses);
router
  .route("/:id/check-purchase/:user_id")
  .get(authenticateUser, bundleController.checkPurchaseStatus);
router
  .route("/:id/check-prebook/:user_id")
  .get(authenticateUser, bundleController.checkPrebookStatus);
router
  .route("/:id/check-duplicates/:user_id")
  .get(authenticateUser, bundleController.checkDuplicateCourses);
router
  .route("/:id/course-access")
  .get(optAuthenticateUser, bundleController.getCourseAccess);

// Legacy routes for backward compatibility (still using request body)
router
  .route("/my-bundles")
  .get(authenticateUser, bundleController.getMyBundles);
router
  .route("/bundle-courses")
  .get(authenticateUser, bundleController.getBundleCourses);
router
  .route("/all-courses")
  .get(authenticateUser, bundleController.getAllCourses);

module.exports = router;
