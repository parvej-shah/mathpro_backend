const Controller = require("../base").Controller;
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
  create = async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Error in coupon create controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get a specific coupon by ID
   * GET /admin/coupon/:id
   */
  getCoupon = async (req, res) => {
    try {
      const couponId = parseInt(req.params.id);

      if (!couponId || isNaN(couponId)) {
        return res.status(400).json({
          success: false,
          error: "Valid coupon ID is required",
        });
      }

      const result = await couponService.getCoupon(couponId);
      return res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error("Error in coupon get controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Update a coupon
   * PUT /admin/coupon/:id
   */
  update = async (req, res) => {
    try {
      const couponId = parseInt(req.params.id);

      if (!couponId || isNaN(couponId)) {
        return res.status(400).json({
          success: false,
          error: "Valid coupon ID is required",
        });
      }

      const result = await couponService.updateCoupon(couponId, req.body);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in coupon update controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Delete a coupon
   * DELETE /admin/coupon/:id
   */
  deleteCoupon = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in coupon delete controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * List coupons with pagination and filtering
   * GET /admin/coupon
   */
  list = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in coupon list controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Add courses to a coupon
   * POST /admin/coupon/:id/courses
   */
  addCoursesToCoupon = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in add courses to coupon controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Remove courses from a coupon
   * DELETE /admin/coupon/:id/courses
   */
  removeCoursesFromCoupon = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in remove courses from coupon controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get courses associated with a coupon
   * GET /admin/coupon/:id/courses
   */
  getCouponCourses = async (req, res) => {
    try {
      const couponId = parseInt(req.params.id);

      if (!couponId || isNaN(couponId)) {
        return res.status(400).json({
          success: false,
          error: "Valid coupon ID is required",
        });
      }

      const result = await couponService.getCouponCourses(couponId);
      return res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error("Error in get coupon courses controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get available courses that can be associated with coupons
   * GET /admin/coupon/available-courses
   */
  getAvailableCourses = async (req, res) => {
    try {
      const couponId = req.query.couponId ? parseInt(req.query.couponId) : null;

      const result = await couponService.getAvailableCourses(couponId);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in get available courses controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Add bundles to a coupon
   * POST /admin/coupon/:id/bundles
   */
  addBundlesToCoupon = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in add bundles to coupon controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Remove bundles from a coupon
   * DELETE /admin/coupon/:id/bundles
   */
  removeBundlesFromCoupon = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in remove bundles from coupon controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get bundles associated with a coupon
   * GET /admin/coupon/:id/bundles
   */
  getCouponBundles = async (req, res) => {
    try {
      const couponId = parseInt(req.params.id);

      if (!couponId || isNaN(couponId)) {
        return res.status(400).json({
          success: false,
          error: "Valid coupon ID is required",
        });
      }

      const result = await couponService.getCouponBundles(couponId);
      return res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error("Error in get coupon bundles controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get available bundles that can be associated with coupons
   * GET /admin/coupon/available-bundles
   */
  getAvailableBundles = async (req, res) => {
    try {
      const couponId = req.query.couponId ? parseInt(req.query.couponId) : null;

      const result = await couponService.getAvailableBundles(couponId);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in get available bundles controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get comprehensive coupon usage statistics
   * GET /admin/coupon/analytics/statistics
   */
  getCouponStatistics = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in get coupon statistics controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get revenue impact analytics
   * GET /admin/coupon/analytics/revenue-impact
   */
  getRevenueImpactAnalytics = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate
          ? parseInt(req.query.startDate)
          : undefined,
        endDate: req.query.endDate ? parseInt(req.query.endDate) : undefined,
        courseId: req.query.courseId ? parseInt(req.query.courseId) : undefined,
      };

      const result = await couponService.getRevenueImpactAnalytics(filters);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in get revenue impact analytics controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get top performing coupons
   * GET /admin/coupon/analytics/top-performing
   */
  getTopPerformingCoupons = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in get top performing coupons controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get detailed coupon usage report
   * GET /admin/coupon/analytics/usage-report
   */
  getCouponUsageReport = async (req, res) => {
    try {
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
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in get coupon usage report controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get overall analytics dashboard data
   * GET /admin/coupon/analytics/dashboard
   */
  getAnalyticsDashboard = async (req, res) => {
    try {
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
      const totalCouponsResult = await couponService.query(
        `SELECT 
          COUNT(*) as total_coupons,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_coupons,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_coupons,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_coupons
        FROM coupons 
        WHERE status != 'deleted'`
      );

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
    } catch (error) {
      console.error("Error in get analytics dashboard controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get all clicks for a specific coupon
   * GET /admin/coupon/:id/clicks
   * Authentication: Required (admin token)
   */
  getCouponClicks = async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Error in getCouponClicks controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get all coupon clicks (with filters)
   * GET /admin/coupon-clicks
   * Authentication: Required (admin token)
   */
  getAllCouponClicks = async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Error in getAllCouponClicks controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get click statistics for a coupon
   * GET /admin/coupon/:id/click-stats
   * Authentication: Required (admin token)
   */
  getCouponClickStats = async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Error in getCouponClickStats controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };
}

module.exports = { CouponController };
