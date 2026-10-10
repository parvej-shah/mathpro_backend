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
// The :user_id in these URLs must be the caller's own id (from the token). Without this check
// any logged-in student could read another student's purchases by changing the URL.
const ownUserIdOnly = (req, res, next) => {
  if (parseInt(req.params.user_id) !== parseInt(req.user.id)) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }
  return next();
};
router
  .route("/my-bundles/:user_id")
  .get(authenticateUser, ownUserIdOnly, bundleController.getMyBundles);
router
  .route("/bundle-courses/:user_id")
  .get(authenticateUser, ownUserIdOnly, bundleController.getBundleCourses);
router
  .route("/all-courses/:user_id")
  .get(authenticateUser, ownUserIdOnly, bundleController.getAllCourses);
router
  .route("/:id/check-purchase/:user_id")
  .get(authenticateUser, ownUserIdOnly, bundleController.checkPurchaseStatus);
router
  .route("/:id/check-prebook/:user_id")
  .get(authenticateUser, ownUserIdOnly, bundleController.checkPrebookStatus);
router
  .route("/:id/check-duplicates/:user_id")
  .get(authenticateUser, ownUserIdOnly, bundleController.checkDuplicateCourses);
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
