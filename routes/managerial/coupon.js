const router = require("express-promise-router")();
const { CouponController } = require("../../controllers/managerial/coupon");
const { requirePermission, requireAnyPermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const { actorLimiter } = require("../../util/rateLimitPolicies");

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

const couponReadLimit = actorLimiter(
  "admin-coupon:read",
  20,
  15 * 60 * 1000,
  { message: "Too many coupon requests. Please try again later." }
);

const couponWriteLimit = actorLimiter(
  "admin-coupon:write",
  10,
  15 * 60 * 1000,
  { message: "Too many coupon requests. Please try again later." }
);

// IMPORTANT: Specific routes must come BEFORE parameterized routes (/:id)
// Otherwise Express will match "available-courses" or "analytics" as an ID

// Available courses for coupon association (must be before /:id)
router
  .route("/available-courses")
  .get(requireCouponManage, couponReadLimit, couponController.getAvailableCourses);

// Available bundles for coupon association (must be before /:id)
router
  .route("/available-bundles")
  .get(requireCouponManage, couponReadLimit, couponController.getAvailableBundles);

// Click tracking endpoints (must be before /:id)
router
  .route("/coupon-clicks")
  .get(requireCouponOrAnalyticsOrRevenue, couponReadLimit, couponController.getAllCouponClicks);

// Analytics and reporting endpoints (must be before /:id)
router
  .route("/analytics/statistics")
  .get(requireCouponOrAnalyticsOrRevenue, couponReadLimit, couponController.getCouponStatistics);
router
  .route("/analytics/revenue-impact")
  .get(requireCouponOrAnalyticsOrRevenue, couponReadLimit, couponController.getRevenueImpactAnalytics);
router
  .route("/analytics/top-performing")
  .get(requireCouponOrAnalyticsOrRevenue, couponReadLimit, couponController.getTopPerformingCoupons);
router
  .route("/analytics/usage-report")
  .get(requireCouponOrAnalyticsOrRevenue, couponReadLimit, couponController.getCouponUsageReport);
router
  .route("/analytics/dashboard")
  .get(requireCouponOrAnalyticsOrRevenue, couponReadLimit, couponController.getAnalyticsDashboard);

// Admin coupon management routes
router.route("/").get(requireCouponManage, couponReadLimit, couponController.list);
router.route("/").post(requireCouponManage, couponWriteLimit, couponController.create);

// Parameterized routes (must come AFTER specific routes)
router.route("/:id").get(requireCouponManage, couponReadLimit, couponController.getCoupon);
router.route("/:id").put(requireCouponManage, couponWriteLimit, couponController.update);
router.route("/:id").delete(requireCouponManage, couponWriteLimit, couponController.deleteCoupon);

// Course association management
router
  .route("/:id/courses")
  .get(requireCouponManage, couponReadLimit, couponController.getCouponCourses);
router
  .route("/:id/courses")
  .post(requireCouponManage, couponWriteLimit, couponController.addCoursesToCoupon);
router
  .route("/:id/courses")
  .delete(requireCouponManage, couponWriteLimit, couponController.removeCoursesFromCoupon);

// Bundle association management
router
  .route("/:id/bundles")
  .get(requireCouponManage, couponReadLimit, couponController.getCouponBundles);
router
  .route("/:id/bundles")
  .post(requireCouponManage, couponWriteLimit, couponController.addBundlesToCoupon);
router
  .route("/:id/bundles")
  .delete(requireCouponManage, couponWriteLimit, couponController.removeBundlesFromCoupon);

// Click tracking for specific coupon
router
  .route("/:id/clicks")
  .get(requireCouponOrAnalyticsOrRevenue, couponReadLimit, couponController.getCouponClicks);

router
  .route("/:id/click-stats")
  .get(requireCouponOrAnalyticsOrRevenue, couponReadLimit, couponController.getCouponClickStats);

module.exports = router;
