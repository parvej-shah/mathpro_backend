const router = require("express-promise-router")();
const { BundleController } = require("../../controllers/managerial/bundle");
const { requirePermission, requireAnyPermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const bundleController = new BundleController();

// Phase 5: Bundle management - one permission for CRUD/enhanced/courses/export/prebooking
const requireBundleManage = requirePermission(PERMISSIONS.BUNDLE.MANAGE.ALL);
// Stats/purchases: bundle.manage.all OR analytics (per mapping plan)
const requireBundleManageOrAnalytics = requireAnyPermission([
  PERMISSIONS.BUNDLE.MANAGE.ALL,
  PERMISSIONS.ANALYTICS.READ.ALL,
  PERMISSIONS.ANALYTICS.MANAGE.ALL,
]);

// Static routes first (so /purchases, /prebookings are not matched as /:id)
router
  .route("/purchases/api")
  .get(requireBundleManageOrAnalytics, bundleController.getAllBundlePurchasesApi);
router
  .route("/purchases")
  .get(requireBundleManageOrAnalytics, bundleController.getAllBundlePurchases);
router
  .route("/purchases/export")
  .get(requireBundleManage, bundleController.exportBundlePurchases);
router
  .route("/prebookings")
  .get(requireBundleManage, bundleController.getAllBundlePrebookings);
router
  .route("/prebookings/api")
  .get(requireBundleManage, bundleController.getAllBundlePrebookingsApi);
router
  .route("/prebooking/:prebookingId/utm")
  .put(requireBundleManage, bundleController.updateBundlePrebookingUtm);
router
  .route("/prebooking/:prebookingId/utm")
  .delete(requireBundleManage, bundleController.deleteBundlePrebookingUtm);

// Bundle CRUD operations
router.route("/").get(requireBundleManage, bundleController.list);
router.route("/").post(requireBundleManage, bundleController.create);

// Enhanced Bundle CRUD operations (with all fields)
router
  .route("/enhanced")
  .post(requireBundleManage, bundleController.createEnhanced);
router
  .route("/enhanced/:id")
  .put(requireBundleManage, bundleController.updateEnhanced);
router
  .route("/slug/:slug")
  .get(requireBundleManage, bundleController.getBySlug);

// Parameterized routes (/:id must come after static paths)
router.route("/:id").get(requireBundleManage, bundleController.get);
router.route("/:id").put(requireBundleManage, bundleController.update);
router.route("/:id").delete(requireBundleManage, bundleController.delete);
router
  .route("/:id/courses")
  .post(requireBundleManage, bundleController.addCoursesToBundle);
router
  .route("/:id/stats")
  .get(requireBundleManageOrAnalytics, bundleController.getBundleStats);
router
  .route("/:id/purchases")
  .get(requireBundleManageOrAnalytics, bundleController.getAllBundlePurchases);
router
  .route("/:id/purchases/export")
  .get(requireBundleManage, bundleController.exportBundlePurchases);

module.exports = router;
