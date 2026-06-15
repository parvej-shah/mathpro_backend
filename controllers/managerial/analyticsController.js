const Controller = require("../base").Controller;
const AnalyticsV2Service = require("../../service/managerial/analyticsV2/analyticsV2Service")
  .AnalyticsV2Service;
const { AnalyticsV2MetadataService } = require("../../service/managerial/analyticsV2/analyticsV2MetadataService");
const { getAccessibleCourseIds, checkCourseAccess } = require("../../util/courseAccessHelpers");

const analyticsService = new AnalyticsV2Service();
const metadataService = new AnalyticsV2MetadataService();

class AnalyticsController extends Controller {
  constructor() {
    super();
  }

  getDashboardOverview = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        period: req.query.period || undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getDashboardOverview(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getDashboardOverview:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getDashboardTimeseries = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        period: req.query.period || undefined,
        groupBy: req.query.group_by || undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getDashboardTimeseries(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getDashboardTimeseries:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getDashboardBreakdown = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        period: req.query.period || undefined,
        dimension: req.query.dimension || undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getDashboardBreakdown(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getDashboardBreakdown:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getRevenueSummary = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        groupBy: req.query.group_by || undefined,
        courseId: req.query.course_id ? parseInt(req.query.course_id) : undefined,
        bundleId: req.query.bundle_id ? parseInt(req.query.bundle_id) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      if (filters.courseId) {
        const courseAccess = await checkCourseAccess(userId, "analytics", "manage", filters.courseId);
        if (!courseAccess.hasAccess) {
          return res.status(403).json({ success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" });
        }
      }
      const result = await analyticsService.getRevenueSummary(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getRevenueSummary:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getRevenueTrends = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        groupBy: req.query.group_by || "day",
        courseId: req.query.course_id ? parseInt(req.query.course_id) : undefined,
        bundleId: req.query.bundle_id ? parseInt(req.query.bundle_id) : undefined,
      };
      if (!filters.startDate || !filters.endDate) {
        return res.status(400).json({ success: false, error: "start_date and end_date are required" });
      }
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      if (filters.courseId) {
        const courseAccess = await checkCourseAccess(userId, "analytics", "manage", filters.courseId);
        if (!courseAccess.hasAccess) {
          return res.status(403).json({ success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" });
        }
      }
      const result = await analyticsService.getRevenueTrends(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getRevenueTrends:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getRevenueByCourse = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
        sortBy: req.query.sort_by || "revenue",
        order: req.query.order || "desc",
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getRevenueByCourse(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getRevenueByCourse:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getRevenueByBundle = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
        sortBy: req.query.sort_by || "revenue",
        order: req.query.order || "desc",
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getRevenueByBundle(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getRevenueByBundle:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getRevenuePredictions = async (req, res) => {
    try {
      const filters = {
        period: req.query.period || "month",
        method: req.query.method || "average",
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getRevenuePredictions(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getRevenuePredictions:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getUserOverview = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getUserOverview(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getUserOverview:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getUserGrowth = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        groupBy: req.query.group_by || "month",
      };
      if (!filters.startDate || !filters.endDate) {
        return res.status(400).json({ success: false, error: "start_date and end_date are required" });
      }
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getUserGrowth(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getUserGrowth:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getUserEngagement = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        userId: req.query.user_id ? parseInt(req.query.user_id) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getUserEngagement(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getUserEngagement:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getCourseOverview = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        courseId: req.query.course_id ? parseInt(req.query.course_id) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      if (filters.courseId) {
        const courseAccess = await checkCourseAccess(userId, "analytics", "manage", filters.courseId);
        if (!courseAccess.hasAccess) {
          return res.status(403).json({ success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" });
        }
      }
      const result = await analyticsService.getCourseOverview(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getCourseOverview:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getCourseDetailed = async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      if (isNaN(courseId)) {
        return res.status(400).json({ success: false, error: "Invalid course ID" });
      }
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
      };
      const userId = req.user.id;
      const courseAccess = await checkCourseAccess(userId, "analytics", "manage", courseId);
      if (!courseAccess.hasAccess) {
        return res.status(403).json({ success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" });
      }
      const result = await analyticsService.getCourseDetailed(courseId, filters);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getCourseDetailed:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getCourseCompletion = async (req, res) => {
    try {
      const filters = {
        courseId: req.query.course_id ? parseInt(req.query.course_id) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      if (filters.courseId) {
        const courseAccess = await checkCourseAccess(userId, "analytics", "manage", filters.courseId);
        if (!courseAccess.hasAccess) {
          return res.status(403).json({ success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" });
        }
      }
      const result = await analyticsService.getCourseCompletion(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getCourseCompletion:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getBundleOverview = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getBundleOverview(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getBundleOverview:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getBundleDetailed = async (req, res) => {
    try {
      const bundleId = parseInt(req.params.bundleId);
      if (isNaN(bundleId)) {
        return res.status(400).json({ success: false, error: "Invalid bundle ID" });
      }
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getBundleDetailed(bundleId, filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getBundleDetailed:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getLearningProgress = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        courseId: req.query.course_id ? parseInt(req.query.course_id) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      if (filters.courseId) {
        const courseAccess = await checkCourseAccess(userId, "analytics", "manage", filters.courseId);
        if (!courseAccess.hasAccess) {
          return res.status(403).json({ success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" });
        }
      }
      const result = await analyticsService.getLearningProgress(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getLearningProgress:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getStreakAnalytics = async (req, res) => {
    try {
      const filters = {
        courseId: req.query.course_id ? parseInt(req.query.course_id) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      if (filters.courseId) {
        const courseAccess = await checkCourseAccess(userId, "analytics", "manage", filters.courseId);
        if (!courseAccess.hasAccess) {
          return res.status(403).json({ success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" });
        }
      }
      const result = await analyticsService.getStreakAnalytics(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getStreakAnalytics:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getCouponOverview = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getCouponOverview(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getCouponOverview:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getCouponPerformance = async (req, res) => {
    try {
      const filters = {
        couponId: req.query.coupon_id ? parseInt(req.query.coupon_id) : undefined,
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getCouponPerformance(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getCouponPerformance:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getPaymentOverview = async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
        endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
      };
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getPaymentOverview(filters, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getPaymentOverview:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getFilterOptions = async (req, res) => {
    try {
      const type = req.query.type;
      if (!type) {
        return res.status(400).json({ success: false, error: "type parameter is required" });
      }
      const userId = req.user.id;
      const access = await getAccessibleCourseIds(userId, "analytics", "manage");
      const result = await analyticsService.getFilterOptions(type, access);
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error("Error in getFilterOptions:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getAllMetadata = async (req, res) => {
    try {
      const metadata = metadataService.getAllMetadata();
      return res.status(200).json({ success: true, data: metadata });
    } catch (error) {
      console.error("Error in getAllMetadata:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getCategoryMetadata = async (req, res) => {
    try {
      const { category } = req.params;
      const metadata = metadataService.getCategoryMetadata(category);
      if (Object.keys(metadata).length === 0) {
        return res.status(404).json({ success: false, error: `Category '${category}' not found` });
      }
      return res.status(200).json({ success: true, data: metadata });
    } catch (error) {
      console.error("Error in getCategoryMetadata:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

  getDataPointMetadata = async (req, res) => {
    try {
      const { category, key } = req.params;
      const metadata = metadataService.getMetadata(category, key);
      if (!metadata) {
        return res.status(404).json({ success: false, error: `Data point '${category}.${key}' not found` });
      }
      return res.status(200).json({ success: true, data: metadata });
    } catch (error) {
      console.error("Error in getDataPointMetadata:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  };
}

module.exports = { AnalyticsController };
