const Controller = require("../base").Controller;
const { catchAs } = require("../base");
const { parseLimitOffset } = require("../../util/pagination");
const AnalyticsV2Service = require("../../service/managerial/analyticsV2/analyticsV2Service")
  .AnalyticsV2Service;
const { AnalyticsV2MetadataService } = require("../../service/managerial/analyticsV2/analyticsV2MetadataService");
const { getAccessibleCourseIds, checkCourseAccess } = require("../../util/courseAccessHelpers");
const { noCourseAccess } = require("../shared/courseAccess");

const analyticsService = new AnalyticsV2Service();
const metadataService = new AnalyticsV2MetadataService();

// Query-string helpers: integer params are optional (`fallback` when absent).
const intParam = (value, fallback) => (value ? parseInt(value) : fallback);
const dateFilters = (query) => ({
  startDate: intParam(query.start_date),
  endDate: intParam(query.end_date),
});

const analyticsAccess = (req) => getAccessibleCourseIds(req.user.id, "analytics", "manage");

// An optional course_id filter the caller can't manage → 403 (the sent response); else null.
const denyCourse = async (req, res, courseId) => {
  if (!courseId) return null;
  const courseAccess = await checkCourseAccess(req.user.id, "analytics", "manage", courseId);
  return courseAccess.hasAccess ? null : noCourseAccess(res);
};

// Analytics replies are 200 on success and 500 on a failed service result.
const sendResult = (res, result) => res.status(result.success ? 200 : 500).json(result);

class AnalyticsController extends Controller {
  constructor() {
    super();
  }

  getDashboardOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      period: req.query.period || undefined,
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getDashboardOverview(filters, access);
    return sendResult(res, result);
  });

  getDashboardTimeseries = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      period: req.query.period || undefined,
      groupBy: req.query.group_by || undefined,
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getDashboardTimeseries(filters, access);
    return sendResult(res, result);
  });

  getDashboardBreakdown = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      period: req.query.period || undefined,
      dimension: req.query.dimension || undefined,
      limit: intParam(req.query.limit),
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getDashboardBreakdown(filters, access);
    return sendResult(res, result);
  });

  getRevenueSummary = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      groupBy: req.query.group_by || undefined,
      courseId: intParam(req.query.course_id),
      bundleId: intParam(req.query.bundle_id),
    };
    const access = await analyticsAccess(req);
    const denied = await denyCourse(req, res, filters.courseId);
    if (denied) return denied;
    const result = await analyticsService.getRevenueSummary(filters, access);
    return sendResult(res, result);
  });

  getRevenueTrends = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      groupBy: req.query.group_by || "day",
      courseId: intParam(req.query.course_id),
      bundleId: intParam(req.query.bundle_id),
    };
    if (!filters.startDate || !filters.endDate) {
      return res.status(400).json({ success: false, error: "start_date and end_date are required" });
    }
    const access = await analyticsAccess(req);
    const denied = await denyCourse(req, res, filters.courseId);
    if (denied) return denied;
    const result = await analyticsService.getRevenueTrends(filters, access);
    return sendResult(res, result);
  });

  getRevenueByCourse = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      ...parseLimitOffset(req.query, { defaultLimit: 20, maxLimit: 100 }),
      sortBy: req.query.sort_by || "revenue",
      order: req.query.order || "desc",
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getRevenueByCourse(filters, access);
    return sendResult(res, result);
  });

  getRevenueByBundle = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      ...parseLimitOffset(req.query, { defaultLimit: 20, maxLimit: 100 }),
      sortBy: req.query.sort_by || "revenue",
      order: req.query.order || "desc",
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getRevenueByBundle(filters, access);
    return sendResult(res, result);
  });

  getRevenuePredictions = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      period: req.query.period || "month",
      method: req.query.method || "average",
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getRevenuePredictions(filters, access);
    return sendResult(res, result);
  });

  getUserOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getUserOverview(filters, access);
    return sendResult(res, result);
  });

  getUserGrowth = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      groupBy: req.query.group_by || "month",
    };
    if (!filters.startDate || !filters.endDate) {
      return res.status(400).json({ success: false, error: "start_date and end_date are required" });
    }
    const access = await analyticsAccess(req);
    const result = await analyticsService.getUserGrowth(filters, access);
    return sendResult(res, result);
  });

  getUserEngagement = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      userId: intParam(req.query.user_id),
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getUserEngagement(filters, access);
    return sendResult(res, result);
  });

  getCourseOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      courseId: intParam(req.query.course_id),
    };
    const access = await analyticsAccess(req);
    const denied = await denyCourse(req, res, filters.courseId);
    if (denied) return denied;
    const result = await analyticsService.getCourseOverview(filters, access);
    return sendResult(res, result);
  });

  getCourseDetailed = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) {
      return res.status(400).json({ success: false, error: "Invalid course ID" });
    }
    const filters = {
      ...dateFilters(req.query),
    };
    const courseAccess = await checkCourseAccess(req.user.id, "analytics", "manage", courseId);
    if (!courseAccess.hasAccess) return noCourseAccess(res);
    const result = await analyticsService.getCourseDetailed(courseId, filters);
    return sendResult(res, result);
  });

  getCourseCompletion = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      courseId: intParam(req.query.course_id),
      ...parseLimitOffset(req.query, { defaultLimit: 20, maxLimit: 100 }),
    };
    const access = await analyticsAccess(req);
    const denied = await denyCourse(req, res, filters.courseId);
    if (denied) return denied;
    const result = await analyticsService.getCourseCompletion(filters, access);
    return sendResult(res, result);
  });

  getBundleOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getBundleOverview(filters, access);
    return sendResult(res, result);
  });

  getBundleDetailed = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const bundleId = parseInt(req.params.bundleId);
    if (isNaN(bundleId)) {
      return res.status(400).json({ success: false, error: "Invalid bundle ID" });
    }
    const filters = {
      ...dateFilters(req.query),
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getBundleDetailed(bundleId, filters, access);
    return sendResult(res, result);
  });

  getLearningProgress = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
      courseId: intParam(req.query.course_id),
    };
    const access = await analyticsAccess(req);
    const denied = await denyCourse(req, res, filters.courseId);
    if (denied) return denied;
    const result = await analyticsService.getLearningProgress(filters, access);
    return sendResult(res, result);
  });

  getStreakAnalytics = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      courseId: intParam(req.query.course_id),
      ...parseLimitOffset(req.query, { defaultLimit: 20, maxLimit: 100 }),
    };
    const access = await analyticsAccess(req);
    const denied = await denyCourse(req, res, filters.courseId);
    if (denied) return denied;
    const result = await analyticsService.getStreakAnalytics(filters, access);
    return sendResult(res, result);
  });

  getCouponOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getCouponOverview(filters, access);
    return sendResult(res, result);
  });

  getCouponPerformance = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      couponId: intParam(req.query.coupon_id),
      ...dateFilters(req.query),
      ...parseLimitOffset(req.query, { defaultLimit: 20, maxLimit: 100 }),
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getCouponPerformance(filters, access);
    return sendResult(res, result);
  });

  getPaymentOverview = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const filters = {
      ...dateFilters(req.query),
    };
    const access = await analyticsAccess(req);
    const result = await analyticsService.getPaymentOverview(filters, access);
    return sendResult(res, result);
  });

  getFilterOptions = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const type = req.query.type;
    if (!type) {
      return res.status(400).json({ success: false, error: "type parameter is required" });
    }
    const access = await analyticsAccess(req);
    const result = await analyticsService.getFilterOptions(type, access);
    return sendResult(res, result);
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
