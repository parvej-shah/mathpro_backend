const Controller = require("../base").Controller;
const { catchAs } = require("../base");
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

  getDashboardOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
      endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
      period: req.query.period || undefined,
    };
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, "analytics", "manage");
    const result = await analyticsService.getDashboardOverview(filters, access);
    return res.status(result.success ? 200 : 500).json(result);
  });

  getDashboardTimeseries = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getDashboardBreakdown = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getRevenueSummary = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getRevenueTrends = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getRevenueByCourse = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getRevenueByBundle = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getRevenuePredictions = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      period: req.query.period || "month",
      method: req.query.method || "average",
    };
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, "analytics", "manage");
    const result = await analyticsService.getRevenuePredictions(filters, access);
    return res.status(result.success ? 200 : 500).json(result);
  });

  getUserOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
      endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
    };
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, "analytics", "manage");
    const result = await analyticsService.getUserOverview(filters, access);
    return res.status(result.success ? 200 : 500).json(result);
  });

  getUserGrowth = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getUserEngagement = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
      endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
      userId: req.query.user_id ? parseInt(req.query.user_id) : undefined,
    };
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, "analytics", "manage");
    const result = await analyticsService.getUserEngagement(filters, access);
    return res.status(result.success ? 200 : 500).json(result);
  });

  getCourseOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getCourseDetailed = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getCourseCompletion = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getBundleOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
      endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
    };
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, "analytics", "manage");
    const result = await analyticsService.getBundleOverview(filters, access);
    return res.status(result.success ? 200 : 500).json(result);
  });

  getBundleDetailed = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getLearningProgress = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getStreakAnalytics = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getCouponOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
      endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
    };
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, "analytics", "manage");
    const result = await analyticsService.getCouponOverview(filters, access);
    return res.status(result.success ? 200 : 500).json(result);
  });

  getCouponPerformance = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
  });

  getPaymentOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      startDate: req.query.start_date ? parseInt(req.query.start_date) : undefined,
      endDate: req.query.end_date ? parseInt(req.query.end_date) : undefined,
    };
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, "analytics", "manage");
    const result = await analyticsService.getPaymentOverview(filters, access);
    return res.status(result.success ? 200 : 500).json(result);
  });

  getFilterOptions = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const type = req.query.type;
    if (!type) {
      return res.status(400).json({ success: false, error: "type parameter is required" });
    }
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, "analytics", "manage");
    const result = await analyticsService.getFilterOptions(type, access);
    return res.status(result.success ? 200 : 500).json(result);
  });

  getAllMetadata = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const metadata = metadataService.getAllMetadata();
    return res.status(200).json({ success: true, data: metadata });
  });

  getCategoryMetadata = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { category } = req.params;
    const metadata = metadataService.getCategoryMetadata(category);
    if (Object.keys(metadata).length === 0) {
      return res.status(404).json({ success: false, error: `Category '${category}' not found` });
    }
    return res.status(200).json({ success: true, data: metadata });
  });

  getDataPointMetadata = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { category, key } = req.params;
    const metadata = metadataService.getMetadata(category, key);
    if (!metadata) {
      return res.status(404).json({ success: false, error: `Data point '${category}.${key}' not found` });
    }
    return res.status(200).json({ success: true, data: metadata });
  });
}

module.exports = { AnalyticsController };
