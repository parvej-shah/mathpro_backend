// Revenue: summary, trends, per course / bundle, predictions.
// Part of AnalyticsV2Service (../analyticsV2Service.js), which callers use.
//
// Sales are paid course enrolments (takes with an amount and a transaction id) plus bundle
// purchases. A course-scoped admin (access.hasGlobalAccess === false) sees the sales of their
// courses and of bundles that contain one of them. Both timestamp columns are INTEGER seconds.
const { AnalyticsV2Base } = require("./base");
const { parseDateRange } = require("../../../../util/analyticsV2/dateUtils");
const { buildOrderBy, validateLimit, validateOffset, buildDateGrouping } = require("../../../../util/analyticsV2/queryUtils");
const logger = require('../../../../util/logger');

// Every query's params start as [range.start, range.end]; either bound may be null (open).
const IN_RANGE = `($1::bigint IS NULL OR timestamp >= $1) AND ($2::bigint IS NULL OR timestamp <= $2)`;

// Appends a param and returns its placeholder.
const bind = (params, value) => {
  params.push(value);
  return `$${params.length}`;
};

// SQL: the bundle contains one of the courses in the array param `ref`.
const bundleInScope = (bundleColumn, ref) =>
  `EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = ${bundleColumn} AND bc.course_id = ANY(${ref}))`;

// WHERE for paid course sales in the range, optionally one course, limited to `scope` course ids.
const courseSales = (params, { courseId, scope } = {}) => {
  let where = `amount IS NOT NULL AND transaction_id IS NOT NULL AND ${IN_RANGE}`;
  if (courseId) where += ` AND course_id = ${bind(params, courseId)}`;
  if (scope) where += ` AND course_id = ANY(${bind(params, scope)})`;
  return where;
};

// WHERE for bundle purchases in the range, optionally one bundle, limited to `scope` course ids.
const bundleSales = (params, { bundleId, scope } = {}) => {
  let where = IN_RANGE;
  if (bundleId) where += ` AND bundle_id = ${bind(params, bundleId)}`;
  if (scope) where += ` AND ${bundleInScope('bundle_purchase.bundle_id', bind(params, scope))}`;
  return where;
};

const firstRow = (result) => (result.success && result.data[0]) || null;
const sum = (values) => values.reduce((a, b) => a + b, 0);
const round2 = (value) => parseFloat(value.toFixed(2));
// "YYYY-MM-DD" for a DATE_TRUNC period.
const periodDay = (period) => (period ? new Date(period).toISOString().split("T")[0] : null);

// Course and bundle trend rows merged by day, oldest first.
const mergeTrends = (courseRows, bundleRows) => {
  const trendsMap = new Map();
  for (const t of courseRows) {
    const period = periodDay(t.period);
    if (period) {
      const revenue = parseFloat(t.revenue);
      trendsMap.set(period, { period, revenue, enrollments: parseInt(t.enrollments), course_revenue: revenue, bundle_revenue: 0 });
    }
  }
  for (const t of bundleRows) {
    const period = periodDay(t.period);
    if (!period) continue;
    const revenue = parseFloat(t.revenue);
    const existing = trendsMap.get(period);
    if (existing) {
      existing.bundle_revenue = revenue;
      existing.revenue += revenue;
    } else {
      trendsMap.set(period, { period, revenue, enrollments: 0, course_revenue: 0, bundle_revenue: revenue });
    }
  }
  return Array.from(trendsMap.values()).sort((a, b) => a.period.localeCompare(b.period));
};

// A page of a per-item breakdown: { [listKey]: rows, meta: { total, limit, offset } }.
const pageReply = (listKey, result, countResult, mapRow, limit, offset) => {
  if (!result.success) {
    return result;
  }
  const countRow = firstRow(countResult);
  return {
    success: true,
    data: {
      [listKey]: (result.data || []).map(mapRow),
      meta: { total: countRow ? parseInt(countRow.total) : 0, limit, offset },
    },
  };
};
const emptyPage = (listKey, limit, offset) => ({
  success: true,
  data: { [listKey]: [], meta: { total: 0, limit, offset } },
});

// Prediction look-back: period length and how many past periods are averaged.
const PREDICTION_WINDOWS = {
  week: { seconds: 7 * 86400, periods: 6 },
  month: { seconds: 30 * 86400, periods: 6 },
  quarter: { seconds: 90 * 86400, periods: 6 },
  year: { seconds: 365 * 86400, periods: 3 },
};

// average: mean of the periods. trend: mean of the last 3 periods, grown by their change
// against the earlier ones (falls back to the mean below 2 periods). Unknown methods predict 0.
const predict = (revenues, method) => {
  const confidence = revenues.length >= 4 ? "medium" : "low";
  if (method === "average") {
    return { predictedRevenue: round2(sum(revenues) / revenues.length), confidence, growthRate: 0 };
  }
  if (method !== "trend") {
    return { predictedRevenue: 0, confidence: "low", growthRate: 0 };
  }
  if (revenues.length < 2) {
    return { predictedRevenue: round2(sum(revenues) / revenues.length), confidence: "low", growthRate: 0 };
  }
  const recent = revenues.slice(-3);
  const older = revenues.slice(0, -3);
  const recentAvg = sum(recent) / recent.length;
  const olderAvg = older.length > 0 ? sum(older) / older.length : recentAvg;
  const growthRate = olderAvg > 0 ? round2(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
  return { predictedRevenue: round2(recentAvg * (1 + growthRate / 100)), confidence, growthRate };
};

class RevenueAnalyticsService extends AnalyticsV2Base {
  constructor() {
    super();
  }

  // The caller's course ids when they are course-scoped, else null (sees everything).
  _scope = (access) => (this._isRestrictedAccess(access) ? this._getAccessibleCourseIds(access) : null);

  // Sum of paid course sales.
  _courseRevenue = async (range, courseId, scope) => {
    const params = [range.start, range.end];
    const where = courseSales(params, { courseId, scope });
    const row = firstRow(await this.query(`SELECT COALESCE(SUM(amount), 0) as revenue FROM takes WHERE ${where}`, params));
    return row ? parseFloat(row.revenue) : 0;
  };

  _bundleRevenue = async (range, bundleId, scope) => {
    const params = [range.start, range.end];
    const where = bundleSales(params, { bundleId, scope });
    const row = firstRow(await this.query(`SELECT COALESCE(SUM(amount), 0) as revenue FROM bundle_purchase WHERE ${where}`, params));
    return row ? parseFloat(row.revenue) : 0;
  };

  // Count and sum of all sales (courses + bundles); the raw row, or null if the query failed.
  _salesTotals = async (range, scope) => {
    const params = [range.start, range.end];
    const query = `
      SELECT COUNT(*) as total_transactions, COALESCE(SUM(amount), 0) as total_revenue
      FROM (
        SELECT amount FROM takes WHERE ${courseSales(params, { scope })}
        UNION ALL
        SELECT amount FROM bundle_purchase WHERE ${bundleSales(params, { scope })}
      ) as all_transactions
    `;
    return firstRow(await this.query(query, params));
  };

  // Completed coupon sales: revenue and discount.
  // KNOWN BUG (kept as is): coupon_usage has no item_type / item_id columns, so for a
  // course-scoped admin this query fails and both figures read 0.
  _couponRevenue = async (range, scope) => {
    const params = [range.start, range.end];
    let scopeSql = "";
    if (scope) {
      const ref = bind(params, scope);
      scopeSql = `AND ((item_type = 'COURSE' AND item_id = ANY(${ref}))
        OR (item_type = 'BUNDLE' AND ${bundleInScope('coupon_usage.item_id', ref)}))`;
    }
    const query = `
      SELECT COALESCE(SUM(final_price), 0) as revenue_with_coupon, COALESCE(SUM(discount_amount), 0) as discount_given
      FROM coupon_usage
      WHERE payment_status = 'completed'
        AND ($1::bigint IS NULL OR used_at >= $1)
        AND ($2::bigint IS NULL OR used_at <= $2)
        ${scopeSql}
    `;
    const row = firstRow(await this.query(query, params));
    return row
      ? { revenue_with_coupon: parseFloat(row.revenue_with_coupon), discount_given: parseFloat(row.discount_given) }
      : { revenue_with_coupon: 0, discount_given: 0 };
  };

  // Enrolments (free ones included) and their amount per period, for the summary.
  _enrolmentTrend = async (range, groupBy, scope) => {
    const params = [range.start, range.end];
    const scopeSql = scope ? `AND course_id = ANY(${bind(params, scope)})` : "";
    const result = await this.query(`
      SELECT ${buildDateGrouping(groupBy, "timestamp", true)} as period,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(*) as enrollments
      FROM takes
      WHERE ${IN_RANGE} ${scopeSql}
      GROUP BY period
      ORDER BY period ASC
    `, params);
    if (!result.success || !result.data) return [];
    return result.data.map((t) => ({
      period: periodDay(t.period),
      revenue: parseFloat(t.revenue),
      enrollments: parseInt(t.enrollments),
    }));
  };

  // Per-period rows (period, revenue, count) of course or bundle sales.
  _salesByPeriod = async (table, salesWhere, filter, groupBy, countAs) => {
    const params = [filter.range.start, filter.range.end];
    const where = salesWhere(params, filter);
    const result = await this.query(`
      SELECT ${buildDateGrouping(groupBy, "timestamp", true)} as period,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(*) as ${countAs}
      FROM ${table}
      WHERE ${where}
      GROUP BY period ORDER BY period ASC
    `, params);
    return result.success && result.data ? result.data : [];
  };

  /**
   * Get revenue summary with comprehensive breakdowns
   * 
   * Provides detailed revenue analytics including:
   * - Total revenue (course + bundle)
   * - Revenue breakdown by source (course vs bundle)
   * - Coupon impact (with/without coupon revenue, discounts given)
   * - Average order value
   * - Total transactions
   * - Optional trends over time if groupBy is provided
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * @param {string} [filters.groupBy] - Group trends by: 'day', 'week', 'month', 'quarter', 'year'
   * @param {number} [filters.courseId] - Filter by specific course ID
   * @param {number} [filters.bundleId] - Filter by specific bundle ID
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Revenue summary data
   * @returns {number} returns.data.total_revenue - Total revenue (course + bundle)
   * @returns {number} returns.data.course_revenue - Revenue from courses
   * @returns {number} returns.data.bundle_revenue - Revenue from bundles
   * @returns {number} returns.data.with_coupon_revenue - Revenue from transactions with coupons
   * @returns {number} returns.data.without_coupon_revenue - Revenue from transactions without coupons
   * @returns {number} returns.data.discount_given - Total discount amount given via coupons
   * @returns {number} returns.data.average_order_value - Average transaction value
   * @returns {number} returns.data.total_transactions - Total number of transactions
   * @returns {Array} [returns.data.trends] - Revenue trends over time (if groupBy provided)
   * @returns {string} [returns.error] - Error message if success is false
   */
  getRevenueSummary = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, groupBy, courseId, bundleId } = filters;
      const range = parseDateRange(startDate, endDate);
      const scope = this._scope(access);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            total_revenue: 0,
            course_revenue: 0,
            bundle_revenue: 0,
            with_coupon_revenue: 0,
            without_coupon_revenue: 0,
            discount_given: 0,
            average_order_value: 0,
            total_transactions: 0,
            trends: [],
          },
        };
      }

      const courseRevenue = await this._courseRevenue(range, courseId, scope);
      const bundleRevenue = await this._bundleRevenue(range, bundleId, scope);
      const couponData = await this._couponRevenue(range, scope);
      const totals = await this._salesTotals(range, scope);
      const totalTransactions = totals ? parseInt(totals.total_transactions) : 0;
      const transactionsRevenue = totals ? parseFloat(totals.total_revenue) : 0;
      const totalRevenue = courseRevenue + bundleRevenue;

      return {
        success: true,
        data: {
          total_revenue: totalRevenue,
          course_revenue: courseRevenue,
          bundle_revenue: bundleRevenue,
          with_coupon_revenue: couponData.revenue_with_coupon,
          without_coupon_revenue: totalRevenue - couponData.discount_given,
          discount_given: couponData.discount_given,
          average_order_value: totalTransactions > 0 ? round2(transactionsRevenue / totalTransactions) : 0,
          total_transactions: totalTransactions,
          trends: groupBy ? await this._enrolmentTrend(range, groupBy, scope) : [],
        },
      };
    } catch (error) {
      logger.error("Error in getRevenueSummary:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get revenue trends over time with detailed breakdowns
   * 
   * Provides time-series revenue data grouped by specified period.
   * Shows revenue, enrollments, and breakdown by course vs bundle for each period.
   * 
   * @param {Object} filters - Filter options
   * @param {number} filters.startDate - Start date as Unix timestamp (seconds) - REQUIRED
   * @param {number} filters.endDate - End date as Unix timestamp (seconds) - REQUIRED
   * @param {string} [filters.groupBy='day'] - Group by: 'day', 'week', 'month', 'quarter', 'year'
   * @param {number} [filters.courseId] - Filter by specific course ID
   * @param {number} [filters.bundleId] - Filter by specific bundle ID
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Revenue trends data
   * @returns {Array} returns.data.trends - Array of trend objects per period
   * @returns {string} returns.data.trends[].period - Period identifier (YYYY-MM-DD format)
   * @returns {number} returns.data.trends[].revenue - Total revenue for period
   * @returns {number} returns.data.trends[].enrollments - Number of enrollments (for courses)
   * @returns {number} returns.data.trends[].course_revenue - Revenue from courses
   * @returns {number} returns.data.trends[].bundle_revenue - Revenue from bundles
   * @returns {Object} returns.data.summary - Summary statistics
   * @returns {number} returns.data.summary.total_revenue - Total revenue across all periods
   * @returns {number} returns.data.summary.average_daily_revenue - Average revenue per period
   * @returns {string} [returns.error] - Error message if success is false
   * 
   * @throws {Object} Returns error object if startDate or endDate is missing
   */
  getRevenueTrends = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, groupBy = "day", courseId, bundleId } = filters;

      if (!startDate || !endDate) {
        return {
          success: false,
          error: "start_date and end_date are required",
        };
      }

      const range = parseDateRange(startDate, endDate);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            trends: [],
            summary: {
              total_revenue: 0,
              average_daily_revenue: 0,
            },
          },
        };
      }

      const scope = this._scope(access);
      const courseRows = await this._salesByPeriod('takes', courseSales, { range, courseId, scope }, groupBy, 'enrollments');
      const bundleRows = await this._salesByPeriod('bundle_purchase', bundleSales, { range, bundleId, scope }, groupBy, 'purchases');
      const trends = mergeTrends(courseRows, bundleRows);
      const totalRevenue = sum(trends.map((t) => t.revenue));

      return {
        success: true,
        data: {
          trends,
          summary: {
            total_revenue: totalRevenue,
            average_daily_revenue: trends.length > 0 ? round2(totalRevenue / trends.length) : 0,
          },
        },
      };
    } catch (error) {
      logger.error("Error in getRevenueTrends:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get revenue breakdown by individual courses
   * 
   * Provides detailed revenue analytics for each course including:
   * - Total revenue per course
   * - Number of enrollments
   * - Average revenue per student
   * - Revenue breakdown (with/without coupon)
   * 
   * Supports pagination and sorting by revenue or enrollments.
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * @param {number} [filters.limit=20] - Number of results per page (max 100)
   * @param {number} [filters.offset=0] - Pagination offset
   * @param {string} [filters.sortBy='revenue'] - Sort by: 'revenue' or 'enrollments'
   * @param {string} [filters.order='desc'] - Sort order: 'asc' or 'desc'
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Revenue by course data
   * @returns {Array} returns.data.courses - Array of course revenue objects
   * @returns {number} returns.data.courses[].course_id - Course ID
   * @returns {string} returns.data.courses[].title - Course title
   * @returns {number} returns.data.courses[].revenue - Total revenue from course
   * @returns {number} returns.data.courses[].enrollments - Number of enrollments
   * @returns {number} returns.data.courses[].average_revenue_per_student - Average revenue per enrolled student
   * @returns {number} returns.data.courses[].with_coupon_revenue - Revenue from coupon transactions
   * @returns {number} returns.data.courses[].without_coupon_revenue - Revenue from non-coupon transactions
   * @returns {Object} returns.data.meta - Pagination metadata
   * @returns {number} returns.data.meta.total - Total number of courses
   * @returns {number} returns.data.meta.limit - Results per page
   * @returns {number} returns.data.meta.offset - Current offset
   * @returns {string} [returns.error] - Error message if success is false
   */
  getRevenueByCourse = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, limit = 20, offset = 0, sortBy = "revenue", order = "desc" } = filters;
      const range = parseDateRange(startDate, endDate);
      const validLimit = validateLimit(limit);
      const validOffset = validateOffset(offset);

      if (this._hasNoAccessibleCourses(access)) {
        return emptyPage('courses', validLimit, validOffset);
      }

      const scope = this._scope(access);
      const params = [range.start, range.end];
      const countParams = [];
      const scopeWhere = scope ? `WHERE c.id = ANY(${bind(params, scope)})` : "";
      const countWhere = scope ? `WHERE c.id = ANY(${bind(countParams, scope)})` : "";
      const orderBy = buildOrderBy(sortBy === "enrollments" ? "enrollments" : "revenue", order);

      const result = await this.query(`
        SELECT
          c.id as course_id,
          c.title,
          COALESCE(SUM(t.amount), 0) as revenue,
          COUNT(DISTINCT t.user_id) as enrollments,
          CASE
            WHEN COUNT(DISTINCT t.user_id) > 0
            THEN ROUND(COALESCE(SUM(t.amount), 0)::numeric / COUNT(DISTINCT t.user_id), 2)
            ELSE 0
          END as average_revenue_per_student,
          COALESCE(SUM(CASE WHEN t.coupon_id IS NOT NULL THEN t.amount ELSE 0 END), 0) as with_coupon_revenue,
          COALESCE(SUM(CASE WHEN t.coupon_id IS NULL THEN t.amount ELSE 0 END), 0) as without_coupon_revenue
        FROM course c
        LEFT JOIN takes t ON c.id = t.course_id
          AND t.amount IS NOT NULL
          AND t.transaction_id IS NOT NULL
          AND ($1::bigint IS NULL OR t.timestamp >= $1)
          AND ($2::bigint IS NULL OR t.timestamp <= $2)
        ${scopeWhere}
        GROUP BY c.id, c.title
        ${orderBy}
        LIMIT ${bind(params, validLimit)} OFFSET ${bind(params, validOffset)}
      `, params);
      const countResult = await this.query(`SELECT COUNT(*) as total FROM course c ${countWhere}`, countParams);

      return pageReply('courses', result, countResult, (c) => ({
        course_id: parseInt(c.course_id),
        title: c.title,
        revenue: parseFloat(c.revenue),
        enrollments: parseInt(c.enrollments),
        average_revenue_per_student: parseFloat(c.average_revenue_per_student),
        with_coupon_revenue: parseFloat(c.with_coupon_revenue),
        without_coupon_revenue: parseFloat(c.without_coupon_revenue),
      }), validLimit, validOffset);
    } catch (error) {
      logger.error("Error in getRevenueByCourse:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get revenue breakdown by individual bundles
   * 
   * Provides detailed revenue analytics for each bundle including:
   * - Total revenue per bundle
   * - Number of purchases
   * - Average revenue per purchase
   * - Revenue breakdown (with/without coupon)
   * 
   * Supports pagination and sorting by revenue or purchases.
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * @param {number} [filters.limit=20] - Number of results per page (max 100)
   * @param {number} [filters.offset=0] - Pagination offset
   * @param {string} [filters.sortBy='revenue'] - Sort by: 'revenue' or 'purchases'
   * @param {string} [filters.order='desc'] - Sort order: 'asc' or 'desc'
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Revenue by bundle data
   * @returns {Array} returns.data.bundles - Array of bundle revenue objects
   * @returns {number} returns.data.bundles[].bundle_id - Bundle ID
   * @returns {string} returns.data.bundles[].title - Bundle title
   * @returns {number} returns.data.bundles[].revenue - Total revenue from bundle
   * @returns {number} returns.data.bundles[].purchases - Number of purchases
   * @returns {number} returns.data.bundles[].average_revenue_per_purchase - Average revenue per purchase
   * @returns {number} returns.data.bundles[].with_coupon_revenue - Revenue from coupon transactions
   * @returns {number} returns.data.bundles[].without_coupon_revenue - Revenue from non-coupon transactions
   * @returns {Object} returns.data.meta - Pagination metadata
   * @returns {string} [returns.error] - Error message if success is false
   */
  getRevenueByBundle = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, limit = 20, offset = 0, sortBy = "revenue", order = "desc" } = filters;
      const range = parseDateRange(startDate, endDate);
      const validLimit = validateLimit(limit);
      const validOffset = validateOffset(offset);

      if (this._hasNoAccessibleCourses(access)) {
        return emptyPage('bundles', validLimit, validOffset);
      }

      const scope = this._scope(access);
      const params = [range.start, range.end];
      const countParams = [];
      const scopeWhere = scope ? `WHERE ${bundleInScope('b.id', bind(params, scope))}` : "";
      const countWhere = scope ? `WHERE ${bundleInScope('b.id', bind(countParams, scope))}` : "";
      const orderBy = buildOrderBy(sortBy === "purchases" ? "purchases" : "revenue", order);

      const result = await this.query(`
        SELECT
          b.id as bundle_id,
          b.title,
          COALESCE(SUM(bp.amount), 0) as revenue,
          COUNT(DISTINCT bp.user_id) as purchases,
          CASE
            WHEN COUNT(DISTINCT bp.user_id) > 0
            THEN ROUND(COALESCE(SUM(bp.amount), 0)::numeric / COUNT(DISTINCT bp.user_id), 2)
            ELSE 0
          END as average_revenue_per_purchase,
          COALESCE(SUM(CASE WHEN bp.coupon_id IS NOT NULL THEN bp.amount ELSE 0 END), 0) as with_coupon_revenue,
          COALESCE(SUM(CASE WHEN bp.coupon_id IS NULL THEN bp.amount ELSE 0 END), 0) as without_coupon_revenue
        FROM bundle b
        LEFT JOIN bundle_purchase bp ON b.id = bp.bundle_id
          AND ($1::bigint IS NULL OR bp.timestamp >= $1)
          AND ($2::bigint IS NULL OR bp.timestamp <= $2)
        ${scopeWhere}
        GROUP BY b.id, b.title
        ${orderBy}
        LIMIT ${bind(params, validLimit)} OFFSET ${bind(params, validOffset)}
      `, params);
      const countResult = await this.query(`SELECT COUNT(*) as total FROM bundle b ${countWhere}`, countParams);

      return pageReply('bundles', result, countResult, (b) => ({
        bundle_id: parseInt(b.bundle_id),
        title: b.title,
        revenue: parseFloat(b.revenue),
        purchases: parseInt(b.purchases),
        average_revenue_per_purchase: parseFloat(b.average_revenue_per_purchase),
        with_coupon_revenue: parseFloat(b.with_coupon_revenue),
        without_coupon_revenue: parseFloat(b.without_coupon_revenue),
      }), validLimit, validOffset);
    } catch (error) {
      logger.error("Error in getRevenueByBundle:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get simple revenue predictions based on historical data
   * 
   * Provides revenue forecasts using simple statistical methods:
   * - Average method: Simple average of historical periods
   * - Trend method: Linear trend based on recent vs older periods
   * 
   * Note: Predictions are based on simple statistical calculations, not AI/ML.
   * Includes confidence levels and disclaimers about accuracy.
   * 
   * @param {Object} filters - Filter options
   * @param {string} filters.period - Prediction period: 'week', 'month', 'quarter', 'year' - REQUIRED
   * @param {string} [filters.method='average'] - Prediction method: 'average' or 'trend'
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Prediction data
   * @returns {Object} returns.data.prediction - Prediction details
   * @returns {string} returns.data.prediction.period - Period name (e.g., 'next_month')
   * @returns {number} returns.data.prediction.predicted_revenue - Predicted revenue amount
   * @returns {string} returns.data.prediction.confidence - Confidence level: 'low', 'medium', 'high'
   * @returns {string} returns.data.prediction.method - Method used: 'average' or 'trend'
   * @returns {Object} returns.data.prediction.based_on - Historical data used
   * @returns {number} returns.data.prediction.based_on.historical_periods - Number of periods analyzed
   * @returns {number} returns.data.prediction.based_on.average_revenue - Average historical revenue
   * @returns {number} returns.data.prediction.based_on.growth_rate - Calculated growth rate (for trend method)
   * @returns {string} returns.data.disclaimer - Disclaimer about prediction accuracy
   * @returns {string} [returns.error] - Error message if success is false
   * 
   * @throws {Object} Returns error object if period is invalid or insufficient historical data
   */
  getRevenuePredictions = async (filters = {}, access = null) => {
    try {
      const { period = "month", method = "average" } = filters;

      if (!Object.hasOwn(PREDICTION_WINDOWS, period)) {
        return {
          success: false,
          error: "Invalid period. Must be: week, month, quarter, or year",
        };
      }

      // Sales in each of the last N whole periods, oldest first (failed queries are skipped).
      const { seconds, periods } = PREDICTION_WINDOWS[period];
      const scope = this._scope(access);
      const now = Math.floor(Date.now() / 1000);
      const historicalRevenues = [];
      for (let i = periods; i >= 1; i--) {
        const totals = await this._salesTotals({ start: now - i * seconds, end: now - (i - 1) * seconds }, scope);
        if (totals) historicalRevenues.push(parseFloat(totals.total_revenue));
      }

      if (historicalRevenues.length === 0) {
        return {
          success: false,
          error: "Insufficient historical data for prediction",
        };
      }

      const { predictedRevenue, confidence, growthRate } = predict(historicalRevenues, method);

      return {
        success: true,
        data: {
          prediction: {
            period: `next_${period}`,
            predicted_revenue: predictedRevenue,
            confidence,
            method,
            based_on: {
              historical_periods: historicalRevenues.length,
              average_revenue: sum(historicalRevenues) / historicalRevenues.length,
              growth_rate: growthRate,
            },
          },
          disclaimer:
            "Predictions are based on simple historical averages and trends. Actual results may vary.",
        },
      };
    } catch (error) {
      logger.error("Error in getRevenuePredictions:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };
}

module.exports = { RevenueAnalyticsService };
