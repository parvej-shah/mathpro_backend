const router = require("express-promise-router")();
const { AnalyticsController } = require("../../controllers/managerial/analyticsController");
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const requireAnalyticsManage = requirePermission(PERMISSIONS.ANALYTICS.MANAGE.ALL);

const analyticsController = new AnalyticsController();

// Dashboard
router.route("/dashboard/overview").get(requireAnalyticsManage, analyticsController.getDashboardOverview);
router.route("/dashboard/timeseries").get(requireAnalyticsManage, analyticsController.getDashboardTimeseries);
router.route("/dashboard/breakdown").get(requireAnalyticsManage, analyticsController.getDashboardBreakdown);

// Revenue
router.route("/revenue/summary").get(requireAnalyticsManage, analyticsController.getRevenueSummary);
router.route("/revenue/trends").get(requireAnalyticsManage, analyticsController.getRevenueTrends);
router.route("/revenue/by-course").get(requireAnalyticsManage, analyticsController.getRevenueByCourse);
router.route("/revenue/by-bundle").get(requireAnalyticsManage, analyticsController.getRevenueByBundle);
router.route("/revenue/predictions").get(requireAnalyticsManage, analyticsController.getRevenuePredictions);

// Users
router.route("/users/overview").get(requireAnalyticsManage, analyticsController.getUserOverview);
router.route("/users/growth").get(requireAnalyticsManage, analyticsController.getUserGrowth);
router.route("/users/engagement").get(requireAnalyticsManage, analyticsController.getUserEngagement);

// Courses
router.route("/courses/overview").get(requireAnalyticsManage, analyticsController.getCourseOverview);
router.route("/courses/completion").get(requireAnalyticsManage, analyticsController.getCourseCompletion);
router.route("/courses/:courseId/detailed").get(requireAnalyticsManage, analyticsController.getCourseDetailed);

// Bundles
router.route("/bundles/overview").get(requireAnalyticsManage, analyticsController.getBundleOverview);
router.route("/bundles/:bundleId/detailed").get(requireAnalyticsManage, analyticsController.getBundleDetailed);

// Learning
router.route("/learning/progress").get(requireAnalyticsManage, analyticsController.getLearningProgress);
router.route("/learning/streaks").get(requireAnalyticsManage, analyticsController.getStreakAnalytics);

// Coupons
router.route("/coupons/overview").get(requireAnalyticsManage, analyticsController.getCouponOverview);
router.route("/coupons/performance").get(requireAnalyticsManage, analyticsController.getCouponPerformance);

// Payments
router.route("/payments/overview").get(requireAnalyticsManage, analyticsController.getPaymentOverview);

// Filters
router.route("/filters/options").get(requireAnalyticsManage, analyticsController.getFilterOptions);

// Metadata
router.route("/metadata").get(requireAnalyticsManage, analyticsController.getAllMetadata);
router.route("/metadata/:category").get(requireAnalyticsManage, analyticsController.getCategoryMetadata);
router.route("/metadata/:category/:key").get(requireAnalyticsManage, analyticsController.getDataPointMetadata);

module.exports = router;
