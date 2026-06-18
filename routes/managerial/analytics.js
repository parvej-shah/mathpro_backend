const router = require("express-promise-router")();
const { AnalyticsController } = require("../../controllers/managerial/analyticsController");
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const { actorLimiter } = require("../../util/rateLimitPolicies");

const requireAnalyticsManage = requirePermission(PERMISSIONS.ANALYTICS.MANAGE.ALL);

const analyticsController = new AnalyticsController();

const analyticsReadLimit = actorLimiter(
  "admin-analytics:read",
  20,
  15 * 60 * 1000,
  { message: "Too many analytics requests. Please try again later." }
);

const analyticsHeavyLimit = actorLimiter(
  "admin-analytics:heavy",
  10,
  15 * 60 * 1000,
  { message: "Too many analytics requests. Please try again later." }
);

const analyticsExportLimit = actorLimiter(
  "admin-analytics:export",
  5,
  60 * 60 * 1000,
  { message: "Too many export requests. Please try again later." }
);

// Dashboard
router.route("/dashboard/overview").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getDashboardOverview);
router.route("/dashboard/timeseries").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getDashboardTimeseries);
router.route("/dashboard/breakdown").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getDashboardBreakdown);

// Revenue
router.route("/revenue/summary").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getRevenueSummary);
router.route("/revenue/trends").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getRevenueTrends);
router.route("/revenue/by-course").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getRevenueByCourse);
router.route("/revenue/by-bundle").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getRevenueByBundle);
router.route("/revenue/predictions").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getRevenuePredictions);

// Users
router.route("/users/overview").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getUserOverview);
router.route("/users/growth").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getUserGrowth);
router.route("/users/engagement").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getUserEngagement);

// Courses
router.route("/courses/overview").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getCourseOverview);
router.route("/courses/completion").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getCourseCompletion);
router.route("/courses/:courseId/detailed").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getCourseDetailed);

// Bundles
router.route("/bundles/overview").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getBundleOverview);
router.route("/bundles/:bundleId/detailed").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getBundleDetailed);

// Learning
router.route("/learning/progress").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getLearningProgress);
router.route("/learning/streaks").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getStreakAnalytics);

// Coupons
router.route("/coupons/overview").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getCouponOverview);
router.route("/coupons/performance").get(requireAnalyticsManage, analyticsReadLimit, analyticsController.getCouponPerformance);

// Payments
router.route("/payments/overview").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getPaymentOverview);

// Filters
router.route("/filters/options").get(requireAnalyticsManage, analyticsHeavyLimit, analyticsController.getFilterOptions);

// Metadata
router.route("/metadata").get(requireAnalyticsManage, analyticsExportLimit, analyticsController.getAllMetadata);
router.route("/metadata/:category").get(requireAnalyticsManage, analyticsExportLimit, analyticsController.getCategoryMetadata);
router.route("/metadata/:category/:key").get(requireAnalyticsManage, analyticsExportLimit, analyticsController.getDataPointMetadata);

module.exports = router;
