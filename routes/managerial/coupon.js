const router = require("express-promise-router")();
const { CouponController } = require("../../controllers/managerial/coupon");
const { requirePermission, requireAnyPermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const couponController = new CouponController();

// Phase 5: Coupon management - one permission for CRUD/associations
const requireCouponManage = requirePermission(PERMISSIONS.COUPON.MANAGE.ALL);
// Analytics/revenue endpoints: coupon.manage.all OR revenue OR analytics (per mapping plan)
const requireCouponOrAnalyticsOrRevenue = requireAnyPermission([
  PERMISSIONS.COUPON.MANAGE.ALL,
  PERMISSIONS.REVENUE.READ.ALL,
  PERMISSIONS.REVENUE.MANAGE.ALL,
  PERMISSIONS.ANALYTICS.READ.ALL,
  PERMISSIONS.ANALYTICS.MANAGE.ALL,
]);

// IMPORTANT: Specific routes must come BEFORE parameterized routes (/:id)
// Otherwise Express will match "available-courses" or "analytics" as an ID

// Available courses for coupon association (must be before /:id)
router
  .route("/available-courses")
  .get(requireCouponManage, couponController.getAvailableCourses);

// Available bundles for coupon association (must be before /:id)
router
  .route("/available-bundles")
  .get(requireCouponManage, couponController.getAvailableBundles);

// Click tracking endpoints (must be before /:id)
router
  .route("/coupon-clicks")
  .get(requireCouponOrAnalyticsOrRevenue, couponController.getAllCouponClicks);

// Analytics and reporting endpoints (must be before /:id)
router
  .route("/analytics/statistics")
  .get(requireCouponOrAnalyticsOrRevenue, couponController.getCouponStatistics);
router
  .route("/analytics/revenue-impact")
  .get(requireCouponOrAnalyticsOrRevenue, couponController.getRevenueImpactAnalytics);
router
  .route("/analytics/top-performing")
  .get(requireCouponOrAnalyticsOrRevenue, couponController.getTopPerformingCoupons);
router
  .route("/analytics/usage-report")
  .get(requireCouponOrAnalyticsOrRevenue, couponController.getCouponUsageReport);
router
  .route("/analytics/dashboard")
  .get(requireCouponOrAnalyticsOrRevenue, couponController.getAnalyticsDashboard);

// Admin coupon management routes
router.route("/").get(requireCouponManage, couponController.list);
router.route("/").post(requireCouponManage, couponController.create);

// Parameterized routes (must come AFTER specific routes)
router.route("/:id").get(requireCouponManage, couponController.getCoupon);
router.route("/:id").put(requireCouponManage, couponController.update);
router.route("/:id").delete(requireCouponManage, couponController.deleteCoupon);

// Course association management
router
  .route("/:id/courses")
  .get(requireCouponManage, couponController.getCouponCourses);
router
  .route("/:id/courses")
  .post(requireCouponManage, couponController.addCoursesToCoupon);
router
  .route("/:id/courses")
  .delete(requireCouponManage, couponController.removeCoursesFromCoupon);

// Bundle association management
router
  .route("/:id/bundles")
  .get(requireCouponManage, couponController.getCouponBundles);
router
  .route("/:id/bundles")
  .post(requireCouponManage, couponController.addBundlesToCoupon);
router
  .route("/:id/bundles")
  .delete(requireCouponManage, couponController.removeBundlesFromCoupon);

// Click tracking for specific coupon
router
  .route("/:id/clicks")
  .get(requireCouponOrAnalyticsOrRevenue, couponController.getCouponClicks);

router
  .route("/:id/click-stats")
  .get(requireCouponOrAnalyticsOrRevenue, couponController.getCouponClickStats);

module.exports = router;
