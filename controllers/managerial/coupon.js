const Controller = require("../base").Controller;
const { respond, catchAs } = require('../base');
const CouponService = require("../../service/managerial/coupon");

const couponService = new CouponService();

class CouponController extends Controller {
  constructor() {
    super();
  }

  /**
   * Create a new coupon
   * POST /admin/coupon
   */
  create = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    // authenticateAdmin middleware sets req.body.user_id and req.body.user_type
    const createdBy = req.body.user_id;

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        error: "Admin authentication required",
      });
    }

    const result = await couponService.createCoupon(req.body, createdBy);
    return res.status(result.success ? 201 : 400).json(result);
  });

  /**
   * Get a specific coupon by ID
   * GET /admin/coupon/:id
   */
  getCoupon = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    const result = await couponService.getCoupon(couponId);
    return res.status(result.success ? 200 : 404).json(result);
  });

  /**
   * Update a coupon
   * PUT /admin/coupon/:id
   */
  update = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    const result = await couponService.updateCoupon(couponId, req.body);
    return respond(res, result);
  });

  /**
   * Delete a coupon
   * DELETE /admin/coupon/:id
   */
  deleteCoupon = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);
    // authenticateAdmin middleware sets req.body.user_id and req.body.user_type
    const deletedBy = req.body.user_id;

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    if (!deletedBy) {
      return res.status(400).json({
        success: false,
        error: "Admin authentication required",
      });
    }

    const result = await couponService.deleteCoupon(couponId, deletedBy);
    return respond(res, result);
  });

  /**
   * List coupons with pagination and filtering
   * GET /admin/coupon
   */
  list = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    // Normalize query parameters to handle both snake_case and camelCase
    const discountType = req.query.discountType || req.query.discount_type;
    const createdBy = req.query.createdBy || req.query.created_by;
    const startDate = req.query.startDate || req.query.start_date;
    const endDate = req.query.endDate || req.query.end_date;

    const filters = {
      status: req.query.status,
      discountType: discountType,
      createdBy: createdBy ? parseInt(createdBy) : undefined,
      search: req.query.search,
      startDate: startDate ? parseInt(startDate) : undefined,
      endDate: endDate ? parseInt(endDate) : undefined,
    };

    const pagination = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 10,
      sortBy: req.query.sortBy || "created_at",
      sortOrder: req.query.sortOrder || "DESC",
    };

    const result = await couponService.listCoupons(filters, pagination);
    return respond(res, result);
  });

  /**
   * Add courses to a coupon
   * POST /admin/coupon/:id/courses
   */
  addCoursesToCoupon = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);
    const { courseIds } = req.body;

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Course IDs array is required",
      });
    }

    const result = await couponService.addCoursesToCoupon(
      couponId,
      courseIds
    );
    return respond(res, result);
  });

  /**
   * Remove courses from a coupon
   * DELETE /admin/coupon/:id/courses
   */
  removeCoursesFromCoupon = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);
    const { courseIds } = req.body;

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Course IDs array is required",
      });
    }

    const result = await couponService.removeCoursesFromCoupon(
      couponId,
      courseIds
    );
    return respond(res, result);
  });

  /**
   * Get courses associated with a coupon
   * GET /admin/coupon/:id/courses
   */
  getCouponCourses = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    const result = await couponService.getCouponCourses(couponId);
    return res.status(result.success ? 200 : 404).json(result);
  });

  /**
   * Get available courses that can be associated with coupons
   * GET /admin/coupon/available-courses
   */
  getAvailableCourses = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = req.query.couponId ? parseInt(req.query.couponId) : null;

    const result = await couponService.getAvailableCourses(couponId);
    return respond(res, result);
  });

  /**
   * Add bundles to a coupon
   * POST /admin/coupon/:id/bundles
   */
  addBundlesToCoupon = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);
    const { bundleIds } = req.body;

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    if (!Array.isArray(bundleIds) || bundleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Bundle IDs array is required",
      });
    }

    const result = await couponService.addBundlesToCoupon(
      couponId,
      bundleIds
    );
    return respond(res, result);
  });

  /**
   * Remove bundles from a coupon
   * DELETE /admin/coupon/:id/bundles
   */
  removeBundlesFromCoupon = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);
    const { bundleIds } = req.body;

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    if (!Array.isArray(bundleIds) || bundleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Bundle IDs array is required",
      });
    }

    const result = await couponService.removeBundlesFromCoupon(
      couponId,
      bundleIds
    );
    return respond(res, result);
  });

  /**
   * Get bundles associated with a coupon
   * GET /admin/coupon/:id/bundles
   */
  getCouponBundles = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    const result = await couponService.getCouponBundles(couponId);
    return res.status(result.success ? 200 : 404).json(result);
  });

  /**
   * Get available bundles that can be associated with coupons
   * GET /admin/coupon/available-bundles
   */
  getAvailableBundles = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = req.query.couponId ? parseInt(req.query.couponId) : null;

    const result = await couponService.getAvailableBundles(couponId);
    return respond(res, result);
  });

  /**
   * Get comprehensive coupon usage statistics
   * GET /admin/coupon/analytics/statistics
   */
  getCouponStatistics = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.startDate
        ? parseInt(req.query.startDate)
        : undefined,
      endDate: req.query.endDate ? parseInt(req.query.endDate) : undefined,
      courseId: req.query.courseId ? parseInt(req.query.courseId) : undefined,
      couponId: req.query.couponId ? parseInt(req.query.couponId) : undefined,
      status: req.query.status || "all",
      groupBy: req.query.groupBy || "month",
    };

    const result = await couponService.getCouponUsageStatistics(filters);
    return respond(res, result);
  });

  /**
   * Get revenue impact analytics
   * GET /admin/coupon/analytics/revenue-impact
   */
  getRevenueImpactAnalytics = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.startDate
        ? parseInt(req.query.startDate)
        : undefined,
      endDate: req.query.endDate ? parseInt(req.query.endDate) : undefined,
      courseId: req.query.courseId ? parseInt(req.query.courseId) : undefined,
    };

    const result = await couponService.getRevenueImpactAnalytics(filters);
    return respond(res, result);
  });

  /**
   * Get top performing coupons
   * GET /admin/coupon/analytics/top-performing
   */
  getTopPerformingCoupons = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit) : 10,
      sortBy: req.query.sortBy || "revenue", // 'revenue', 'usage', 'conversion', 'discount'
      startDate: req.query.startDate
        ? parseInt(req.query.startDate)
        : undefined,
      endDate: req.query.endDate ? parseInt(req.query.endDate) : undefined,
      courseId: req.query.courseId ? parseInt(req.query.courseId) : undefined,
    };

    const result = await couponService.getTopPerformingCoupons(options);
    return respond(res, result);
  });

  /**
   * Get detailed coupon usage report
   * GET /admin/coupon/analytics/usage-report
   */
  getCouponUsageReport = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = req.query.couponId ? parseInt(req.query.couponId) : null;
    const filters = {
      startDate: req.query.startDate
        ? parseInt(req.query.startDate)
        : undefined,
      endDate: req.query.endDate ? parseInt(req.query.endDate) : undefined,
      courseId: req.query.courseId ? parseInt(req.query.courseId) : undefined,
      userId: req.query.userId ? parseInt(req.query.userId) : undefined,
      status: req.query.status,
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
    };

    const result = await couponService.getCouponUsageReport(
      couponId,
      filters
    );
    return respond(res, result);
  });

  /**
   * Get overall analytics dashboard data
   * GET /admin/coupon/analytics/dashboard
   */
  getAnalyticsDashboard = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.startDate
        ? parseInt(req.query.startDate)
        : undefined,
      endDate: req.query.endDate ? parseInt(req.query.endDate) : undefined,
    };

    // Get multiple analytics in parallel
    const [usageStats, revenueImpact, topCoupons, overallCoupons] =
      await Promise.all([
        couponService.getCouponUsageStatistics(filters),
        couponService.getRevenueImpactAnalytics(filters),
        couponService.getTopPerformingCoupons({ ...filters, limit: 5 }),
        couponService.listCoupons({}, { page: 1, limit: 1 }), // Just to get total count
      ]);

    // Get total coupons count
    const totalCouponsResult = await couponService.countCouponsByStatus();

    // Merge coupon overview with usage statistics for complete dashboard data
    const couponOverview = totalCouponsResult.success
      ? totalCouponsResult.data[0]
      : { total_coupons: 0, active_coupons: 0, expired_coupons: 0, inactive_coupons: 0 };
    
    const usageOverview = usageStats.success && usageStats.data?.overview
      ? usageStats.data.overview
      : { total_usage: 0, total_usage_attempts: 0, successful_redemptions: 0 };

    const dashboardData = {
      success: true,
      data: {
        coupon_overview: {
          ...couponOverview,
          // Ensure we have total_usage from usage statistics
          total_usage: usageOverview.total_usage || usageOverview.total_usage_attempts || 0,
        },
        usage_statistics: usageStats.success ? usageStats.data : {
          overview: {
            total_usage: 0,
            total_usage_attempts: 0,
            successful_redemptions: 0,
            total_discount_given: 0,
            total_revenue_generated: 0,
          },
          trends: [],
        },
        revenue_impact: revenueImpact.success ? revenueImpact.data : {
          summary: {
            total_original_revenue: 0,
            total_discount_given: 0,
            total_actual_revenue: 0,
            total_successful_uses: 0,
          },
          coupon_performance: [],
        },
        top_performing_coupons: topCoupons.success ? topCoupons.data : [],
        filters_applied: filters,
      },
    };

    return res.status(200).json(dashboardData);
  });

  /**
   * Get all clicks for a specific coupon
   * GET /admin/coupon/:id/clicks
   * Authentication: Required (admin token)
   */
  getCouponClicks = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    // Parse query parameters
    const filters = {
      dateFrom: req.query.date_from ? parseInt(req.query.date_from) : undefined,
      dateTo: req.query.date_to ? parseInt(req.query.date_to) : undefined,
      purchaseCompleted: req.query.purchase_completed !== undefined ? req.query.purchase_completed : undefined,
      page: req.query.page || 1,
      limit: req.query.limit || 20
    };

    const result = await couponService.getCouponClicks(couponId, filters);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  });

  /**
   * Get all coupon clicks (with filters)
   * GET /admin/coupon-clicks
   * Authentication: Required (admin token)
   */
  getAllCouponClicks = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    // Parse query parameters
    const filters = {
      couponId: req.query.coupon_id ? parseInt(req.query.coupon_id) : undefined,
      dateFrom: req.query.date_from ? parseInt(req.query.date_from) : undefined,
      dateTo: req.query.date_to ? parseInt(req.query.date_to) : undefined,
      purchaseCompleted: req.query.purchase_completed !== undefined ? req.query.purchase_completed : undefined,
      page: req.query.page || 1,
      limit: req.query.limit || 20
    };

    const result = await couponService.getAllCouponClicks(filters);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  });

  /**
   * Get click statistics for a coupon
   * GET /admin/coupon/:id/click-stats
   * Authentication: Required (admin token)
   */
  getCouponClickStats = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const couponId = parseInt(req.params.id);

    if (!couponId || isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        error: "Valid coupon ID is required",
      });
    }

    // Parse query parameters for date range
    const dateRange = {
      dateFrom: req.query.date_from ? parseInt(req.query.date_from) : undefined,
      dateTo: req.query.date_to ? parseInt(req.query.date_to) : undefined
    };

    const result = await couponService.getCouponConversionStats(couponId, dateRange);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  });
}

module.exports = { CouponController };
