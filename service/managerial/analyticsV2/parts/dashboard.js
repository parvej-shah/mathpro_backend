// Admin dashboard: overview cards, timeseries, breakdown and filter options.
// Part of AnalyticsV2Service (../analyticsV2Service.js), which callers use.
const { AnalyticsV2Base } = require("./base");
const { parseDateRange, getPreviousPeriod, calculateGrowthPercentage } = require("../../../../util/analyticsV2/dateUtils");
const { buildDateGrouping } = require("../../../../util/analyticsV2/queryUtils");
const logger = require('../../../../util/logger');

class DashboardAnalyticsService extends AnalyticsV2Base {
  constructor() {
    super();
  }

  /** Normalise a postgres date bucket to an ISO date string (YYYY-MM-DD). */
  _periodKey = (raw) => (raw ? new Date(raw).toISOString().split("T")[0] : null);

  /** Pick a sensible grouping based on the span of the range. */
  _defaultGroupBy = (start, end) => {
    if (!start || !end) return "month";
    const days = (end - start) / 86400;
    if (days <= 31) return "day";
    if (days <= 120) return "week";
    if (days <= 730) return "month";
    return "quarter";
  };

  /**
   * Build the combined { period, revenue, enrollments, users } series for a
   * date range / grouping. Each metric is queried independently and merged by
   * period key so a gap in one metric doesn't drop the others.
   */
  _buildDashboardTrends = async (dateRange, groupBy, restricted, courseIds) => {
    const start = dateRange.start;
    const end = dateRange.end;
    if (!start || !end) return [];

    const courseFilter = restricted ? " AND course_id = ANY($3)" : "";
    const revParams = restricted ? [start, end, courseIds] : [start, end];

    // Revenue + enrollments per bucket from `takes` (INTEGER timestamp).
    const revenueQuery = `
      SELECT
        ${buildDateGrouping(groupBy, "timestamp", true)} as period,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(*) as enrollments
      FROM takes
      WHERE timestamp >= $1 AND timestamp <= $2${courseFilter}
      GROUP BY period
      ORDER BY period ASC
    `;

    // New users per bucket from `managerial_auth` (TIMESTAMP column).
    // Users are platform-wide and not course-scoped.
    const usersQuery = `
      SELECT
        ${buildDateGrouping(groupBy, "created_at", false)} as period,
        COUNT(*) FILTER (WHERE type = 3) as users
      FROM managerial_auth
      WHERE created_at >= to_timestamp($1::bigint)
        AND created_at <= to_timestamp($2::bigint)
      GROUP BY period
      ORDER BY period ASC
    `;

    const [revenueResult, usersResult] = await Promise.all([
      this.query(revenueQuery, revParams),
      this.query(usersQuery, [start, end]),
    ]);

    const map = new Map();

    if (revenueResult.success && revenueResult.data) {
      revenueResult.data.forEach((row) => {
        const period = this._periodKey(row.period);
        if (!period) return;
        map.set(period, {
          period,
          revenue: parseFloat(row.revenue) || 0,
          enrollments: parseInt(row.enrollments) || 0,
          users: 0,
        });
      });
    }

    if (usersResult.success && usersResult.data) {
      usersResult.data.forEach((row) => {
        const period = this._periodKey(row.period);
        if (!period) return;
        const existing = map.get(period);
        if (existing) {
          existing.users = parseInt(row.users) || 0;
        } else {
          map.set(period, {
            period,
            revenue: 0,
            enrollments: 0,
            users: parseInt(row.users) || 0,
          });
        }
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );
  };

  /**
   * Get dashboard overview with basic operational metrics
   * 
   * Provides comprehensive platform overview including:
   * - Summary metrics (total users, courses, bundles, revenue, enrollments, active users)
   * - Operational metrics (recent enrollments, payments, failed payment rate)
   * - Revenue and enrollment growth comparisons
   * - Top performing courses and bundles
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds). Optional if period is provided.
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds). Optional if period is provided.
   * @param {string} [filters.period] - Date preset: 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year', 'last_7_days', 'last_30_days', 'last_90_days', 'last_365_days'
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Dashboard data
   * @returns {Object} returns.data.summary - Summary metrics (total_users, total_courses, total_bundles, total_revenue, total_enrollments, active_users_30d)
   * @returns {Object} returns.data.operational - Operational metrics (recent_enrollments_24h, recent_payments_24h, recent_payment_amount_24h, failed_payment_rate_24h)
   * @returns {Object} returns.data.revenue - Revenue comparison (current, previous, growth_percentage)
   * @returns {Object} returns.data.enrollments - Enrollment comparison (current, previous, growth_percentage)
   * @returns {Array} returns.data.top_courses - Top 10 courses by revenue
   * @returns {Array} returns.data.top_bundles - Top 10 bundles by revenue
   * @returns {Object} returns.meta - Metadata (period, start_date, end_date)
   * @returns {string} [returns.error] - Error message if success is false
   * 
   * @example
   * // Get dashboard for this month
   * const result = await service.getDashboardOverview({ period: 'this_month' });
   * 
   * @example
   * // Get dashboard for custom date range
   * const result = await service.getDashboardOverview({
   *   startDate: 1704067200,
   *   endDate: 1706659200
   * });
   */
  getDashboardOverview = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, period } = filters;
      const dateRange = parseDateRange(startDate, endDate, period);
      const now = Math.floor(Date.now() / 1000);
      const day = 86400;
      const last24Hours = now - day;
      const last30Days = now - 30 * day;

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            summary: {
              total_users: 0,
              total_courses: 0,
              total_bundles: 0,
              total_revenue: 0,
              total_enrollments: 0,
              active_users_30d: 0,
              conversion_rate: 0,
              revenue_series: [],
              enrollments_series: [],
              users_series: [],
            },
            operational: {
              recent_enrollments_24h: 0,
              recent_payments_24h: 0,
              recent_payment_amount_24h: 0,
              failed_payment_rate_24h: 0,
            },
            revenue: {
              current: 0,
              previous: 0,
              growth_percentage: 0,
              series: [],
            },
            enrollments: {
              current: 0,
              previous: 0,
              growth_percentage: 0,
              series: [],
            },
            trends: [],
            top_courses: [],
            top_bundles: [],
          },
          meta: {
            period: period || "custom",
            start_date: dateRange.start,
            end_date: dateRange.end,
          },
        };
      }

      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      // Get summary metrics
      const summaryParams = [last30Days];
      const courseIdsParam = restricted ? "$2" : null;

      if (restricted) {
        summaryParams.push(courseIds);
      }

      const summaryQuery = `
        SELECT 
          (SELECT COUNT(*) FROM managerial_auth WHERE type = 3) as total_users,
          (SELECT COUNT(*) FROM course WHERE is_live = true ${restricted ? `AND id = ANY(${courseIdsParam})` : ""}) as total_courses,
          (SELECT COUNT(*) FROM bundle WHERE is_live = true AND is_active = true ${restricted ? `AND EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = bundle.id AND bc.course_id = ANY(${courseIdsParam}))` : ""}) as total_bundles,
          (SELECT COUNT(*) FROM takes WHERE 1 = 1 ${restricted ? `AND course_id = ANY(${courseIdsParam})` : ""}) as total_enrollments,
          (SELECT COALESCE(SUM(amount), 0) FROM takes WHERE amount IS NOT NULL AND transaction_id IS NOT NULL ${restricted ? `AND course_id = ANY(${courseIdsParam})` : ""}) as total_revenue,
          (SELECT COUNT(DISTINCT user_id) FROM takes WHERE amount IS NOT NULL AND transaction_id IS NOT NULL ${restricted ? `AND course_id = ANY(${courseIdsParam})` : ""}) as paying_users,
          (SELECT COUNT(DISTINCT p.user_id) FROM progress p
           JOIN module m ON p.module_id = m.id
           JOIN chapter ch ON m.chapter_id = ch.id
           WHERE p.timestamp >= $1 ${restricted ? `AND ch.course_id = ANY(${courseIdsParam})` : ""}) as active_users_30d
      `;

      const summaryResult = await this.query(summaryQuery, summaryParams);
      if (!summaryResult.success) {
        return summaryResult;
      }

      const summary = summaryResult.data[0];

      // Get recent enrollments (last 24 hours) - Only count VALID payments
      // Count from payment_audit_log where status = 'VALID' and item_type = 'COURSE'
      const recentEnrollmentsQuery = `
        SELECT COUNT(*) as count
        FROM payment_audit_log
        WHERE timestamp >= $1
          AND status = 'VALID'
          AND processing_status = 'SUCCESS'
          AND item_type = 'COURSE'
          ${restricted ? "AND item_id = ANY($2)" : ""}
      `;
      const recentEnrollmentsResult = await this.query(
        recentEnrollmentsQuery,
        restricted ? [last24Hours, courseIds] : [last24Hours]
      );
      const recentEnrollments =
        recentEnrollmentsResult.success && recentEnrollmentsResult.data[0]
          ? parseInt(recentEnrollmentsResult.data[0].count)
          : 0;

      // Get recent payments (last 24 hours) - Only count VALID payments
      // Count from payment_audit_log where status = 'VALID' and processing_status = 'SUCCESS'
      const recentPaymentsQuery = `
        SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(amount), 0) as amount
        FROM payment_audit_log
        WHERE timestamp >= $1
          AND status = 'VALID'
          AND processing_status = 'SUCCESS'
          ${
            restricted
              ? `AND (
            (item_type = 'COURSE' AND item_id = ANY($2))
            OR
            (item_type = 'BUNDLE' AND EXISTS (
              SELECT 1
              FROM bundle_course bc
              WHERE bc.bundle_id = payment_audit_log.item_id
                AND bc.course_id = ANY($2)
            ))
          )`
              : ""
          }
      `;
      const recentPaymentsResult = await this.query(
        recentPaymentsQuery,
        restricted ? [last24Hours, courseIds] : [last24Hours]
      );
      const recentPayments =
        recentPaymentsResult.success && recentPaymentsResult.data[0]
          ? {
              count: parseInt(recentPaymentsResult.data[0].count),
              amount: parseFloat(recentPaymentsResult.data[0].amount),
            }
          : { count: 0, amount: 0 };

      // Get failed payment rate (last 24 hours)
      // Professional calculation from payment_audit_log
      // Failed: status = 'FAILED' OR processing_status = 'FAILED'
      // Total: all payment attempts in last 24 hours
      // Successful: status = 'VALID' AND processing_status = 'SUCCESS'
      const failedPaymentsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'FAILED' OR processing_status = 'FAILED') as failed,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'VALID' AND processing_status = 'SUCCESS') as successful
        FROM payment_audit_log
        WHERE timestamp >= $1
          ${
            restricted
              ? `AND (
            (item_type = 'COURSE' AND item_id = ANY($2))
            OR
            (item_type = 'BUNDLE' AND EXISTS (
              SELECT 1
              FROM bundle_course bc
              WHERE bc.bundle_id = payment_audit_log.item_id
                AND bc.course_id = ANY($2)
            ))
          )`
              : ""
          }
      `;
      const failedPaymentsResult = await this.query(
        failedPaymentsQuery,
        restricted ? [last24Hours, courseIds] : [last24Hours]
      );
      const failedPayments =
        failedPaymentsResult.success && failedPaymentsResult.data[0]
          ? {
              failed: parseInt(failedPaymentsResult.data[0].failed),
              total: parseInt(failedPaymentsResult.data[0].total),
              successful: parseInt(failedPaymentsResult.data[0].successful),
            }
          : { failed: 0, total: 0, successful: 0 };
      const failedPaymentRate =
        failedPayments.total > 0
          ? parseFloat(
              ((failedPayments.failed / failedPayments.total) * 100).toFixed(2)
            )
          : 0;

      // Calculate revenue for current and previous period
      // Note: takes.timestamp is INTEGER (Unix timestamp), so compare directly
      const revenueQuery = `
        SELECT 
          COALESCE(SUM(amount), 0) as revenue,
          COUNT(*) as enrollments
        FROM takes
        WHERE ($1::bigint IS NULL OR timestamp >= $1)
          AND ($2::bigint IS NULL OR timestamp <= $2)
          ${restricted ? "AND course_id = ANY($3)" : ""}
      `;
      const revenueResult = await this.query(
        revenueQuery,
        restricted
          ? [dateRange.start, dateRange.end, courseIds]
          : [dateRange.start, dateRange.end]
      );
      const currentRevenue =
        revenueResult.success && revenueResult.data[0]
          ? {
              revenue: parseFloat(revenueResult.data[0].revenue),
              enrollments: parseInt(revenueResult.data[0].enrollments),
            }
          : { revenue: 0, enrollments: 0 };

      // Get previous period for comparison
      const previousPeriod = getPreviousPeriod(
        dateRange.start || 0,
        dateRange.end || now
      );
      const previousRevenueResult = await this.query(
        revenueQuery,
        restricted
          ? [previousPeriod.start, previousPeriod.end, courseIds]
          : [previousPeriod.start, previousPeriod.end]
      );
      const previousRevenue =
        previousRevenueResult.success && previousRevenueResult.data[0]
          ? {
              revenue: parseFloat(previousRevenueResult.data[0].revenue),
              enrollments: parseInt(previousRevenueResult.data[0].enrollments),
            }
          : { revenue: 0, enrollments: 0 };

      // Get top courses
      const topCoursesQuery = `
        SELECT 
          c.id as course_id,
          c.title,
          COUNT(DISTINCT t.user_id) as enrollments,
          COALESCE(SUM(t.amount), 0) as revenue
        FROM course c
        LEFT JOIN takes t ON c.id = t.course_id
          AND t.amount IS NOT NULL
          AND t.transaction_id IS NOT NULL
        WHERE c.is_live = true
          ${restricted ? "AND c.id = ANY($1)" : ""}
        GROUP BY c.id, c.title
        ORDER BY revenue DESC
        LIMIT 10
      `;
      const topCoursesResult = await this.query(
        topCoursesQuery,
        restricted ? [courseIds] : []
      );

      // Get top bundles
      const topBundlesQuery = `
        SELECT 
          b.id as bundle_id,
          b.title,
          COUNT(DISTINCT bp.user_id) as purchases,
          COALESCE(SUM(bp.amount), 0) as revenue
        FROM bundle b
        LEFT JOIN bundle_purchase bp ON b.id = bp.bundle_id
        WHERE b.is_live = true AND b.is_active = true
          ${
            restricted
              ? "AND EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = b.id AND bc.course_id = ANY($1))"
              : ""
          }
        GROUP BY b.id, b.title
        ORDER BY revenue DESC
        LIMIT 10
      `;
      const topBundlesResult = await this.query(
        topBundlesQuery,
        restricted ? [courseIds] : []
      );

      // Build time-series trends ({ period, revenue, enrollments, users }) so the
      // dashboard renders real curves + KPI sparklines instead of flat 2-point lines.
      const effectiveGroupBy =
        filters.groupBy || this._defaultGroupBy(dateRange.start, dateRange.end);
      const trends = await this._buildDashboardTrends(
        dateRange,
        effectiveGroupBy,
        restricted,
        courseIds
      );
      const revenueSeries = trends.map((t) => ({ period: t.period, value: t.revenue }));
      const enrollmentsSeries = trends.map((t) => ({ period: t.period, value: t.enrollments }));
      const usersSeries = trends.map((t) => ({ period: t.period, value: t.users }));

      // Conversion rate = paying users / total users.
      const totalUsersNum = parseInt(summary.total_users) || 0;
      const payingUsersNum = parseInt(summary.paying_users) || 0;
      const conversionRate =
        totalUsersNum > 0
          ? parseFloat(((payingUsersNum / totalUsersNum) * 100).toFixed(2))
          : 0;

      return {
        success: true,
        data: {
          summary: {
            total_users: parseInt(summary.total_users),
            total_courses: parseInt(summary.total_courses),
            total_bundles: parseInt(summary.total_bundles),
            total_revenue: parseFloat(summary.total_revenue),
            total_enrollments: parseInt(summary.total_enrollments),
            active_users_30d: parseInt(summary.active_users_30d),
            conversion_rate: conversionRate,
            revenue_series: revenueSeries,
            enrollments_series: enrollmentsSeries,
            users_series: usersSeries,
          },
          operational: {
            recent_enrollments_24h: recentEnrollments,
            recent_payments_24h: recentPayments.count,
            recent_payment_amount_24h: recentPayments.amount,
            failed_payment_rate_24h: failedPaymentRate,
          },
          revenue: {
            current: currentRevenue.revenue,
            previous: previousRevenue.revenue,
            growth_percentage: calculateGrowthPercentage(
              currentRevenue.revenue,
              previousRevenue.revenue
            ),
            series: revenueSeries,
          },
          enrollments: {
            current: currentRevenue.enrollments,
            previous: previousRevenue.enrollments,
            growth_percentage: calculateGrowthPercentage(
              currentRevenue.enrollments,
              previousRevenue.enrollments
            ),
            series: enrollmentsSeries,
          },
          trends,
          top_courses:
            topCoursesResult.success && topCoursesResult.data
              ? topCoursesResult.data.map((c) => ({
                  course_id: parseInt(c.course_id),
                  title: c.title,
                  enrollments: parseInt(c.enrollments),
                  revenue: parseFloat(c.revenue),
                }))
              : [],
          top_bundles:
            topBundlesResult.success && topBundlesResult.data
              ? topBundlesResult.data.map((b) => ({
                  bundle_id: parseInt(b.bundle_id),
                  title: b.title,
                  purchases: parseInt(b.purchases),
                  revenue: parseFloat(b.revenue),
                }))
              : [],
        },
        meta: {
          period: period || "custom",
          start_date: dateRange.start,
          end_date: dateRange.end,
        },
      };
    } catch (error) {
      logger.error("Error in getDashboardOverview:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get dashboard time-series — dedicated multi-metric chart feed.
   * Returns { trends: [{ period, revenue, enrollments, users }], summary }.
   *
   * @param {Object} filters - { startDate, endDate, period, groupBy }
   * @param {Object|null} access - Course access scope
   */
  getDashboardTimeseries = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, period, groupBy } = filters;
      const dateRange = parseDateRange(startDate, endDate, period);

      const empty = {
        success: true,
        data: {
          trends: [],
          summary: {
            total_revenue: 0,
            total_enrollments: 0,
            total_users: 0,
            average_daily_revenue: 0,
          },
        },
        meta: {
          period: period || "custom",
          start_date: dateRange.start,
          end_date: dateRange.end,
        },
      };

      if (
        this._hasNoAccessibleCourses(access) ||
        !dateRange.start ||
        !dateRange.end
      ) {
        return empty;
      }

      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);
      const effectiveGroupBy =
        groupBy || this._defaultGroupBy(dateRange.start, dateRange.end);

      const trends = await this._buildDashboardTrends(
        dateRange,
        effectiveGroupBy,
        restricted,
        courseIds
      );

      const totalRevenue = trends.reduce((s, t) => s + t.revenue, 0);
      const totalEnrollments = trends.reduce((s, t) => s + t.enrollments, 0);
      const totalUsers = trends.reduce((s, t) => s + t.users, 0);
      const averageDailyRevenue =
        trends.length > 0
          ? parseFloat((totalRevenue / trends.length).toFixed(2))
          : 0;

      return {
        success: true,
        data: {
          trends,
          summary: {
            total_revenue: totalRevenue,
            total_enrollments: totalEnrollments,
            total_users: totalUsers,
            average_daily_revenue: averageDailyRevenue,
          },
        },
        meta: {
          period: period || "custom",
          start_date: dateRange.start,
          end_date: dateRange.end,
          group_by: effectiveGroupBy,
        },
      };
    } catch (error) {
      logger.error("Error in getDashboardTimeseries:", error);
      return { success: false, error: "Internal server error" };
    }
  };

  /**
   * Get dashboard breakdown — ranked rows for a dimension.
   * Supports dimension = "course" (default) | "bundle".
   * Returns { dimension, rows: [{ id, label, value, secondary, share }], total }.
   *
   * @param {Object} filters - { startDate, endDate, period, dimension, limit }
   * @param {Object|null} access - Course access scope
   */
  getDashboardBreakdown = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, period, dimension, limit } = filters;
      const dateRange = parseDateRange(startDate, endDate, period);
      const dim = dimension === "bundle" ? "bundle" : "course";
      const cap = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

      const meta = {
        period: period || "custom",
        start_date: dateRange.start,
        end_date: dateRange.end,
      };

      if (this._hasNoAccessibleCourses(access)) {
        return { success: true, data: { dimension: dim, rows: [], total: 0 }, meta };
      }

      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);
      const hasRange = !!(dateRange.start && dateRange.end);

      let rows = [];

      if (dim === "bundle") {
        const params = [];
        let dateCond = "";
        if (hasRange) {
          params.push(dateRange.start, dateRange.end);
          dateCond = ` AND bp.timestamp >= $${params.length - 1} AND bp.timestamp <= $${params.length}`;
        }
        let accessCond = "";
        if (restricted) {
          params.push(courseIds);
          accessCond = ` AND EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = b.id AND bc.course_id = ANY($${params.length}))`;
        }
        const query = `
          SELECT b.id, b.title,
            COALESCE(SUM(bp.amount), 0) as value,
            COUNT(DISTINCT bp.user_id) as secondary
          FROM bundle b
          LEFT JOIN bundle_purchase bp ON b.id = bp.bundle_id${dateCond}
          WHERE b.is_live = true AND b.is_active = true${accessCond}
          GROUP BY b.id, b.title
          ORDER BY value DESC
          LIMIT ${cap}
        `;
        const result = await this.query(query, params);
        rows = result.success ? result.data : [];
      } else {
        const params = [];
        let dateCond = "";
        if (hasRange) {
          params.push(dateRange.start, dateRange.end);
          dateCond = ` AND t.timestamp >= $${params.length - 1} AND t.timestamp <= $${params.length}`;
        }
        let accessCond = "";
        if (restricted) {
          params.push(courseIds);
          accessCond = ` AND c.id = ANY($${params.length})`;
        }
        const query = `
          SELECT c.id, c.title,
            COALESCE(SUM(t.amount), 0) as value,
            COUNT(DISTINCT t.user_id) as secondary
          FROM course c
          LEFT JOIN takes t ON c.id = t.course_id
            AND t.amount IS NOT NULL AND t.transaction_id IS NOT NULL${dateCond}
          WHERE c.is_live = true${accessCond}
          GROUP BY c.id, c.title
          ORDER BY value DESC
          LIMIT ${cap}
        `;
        const result = await this.query(query, params);
        rows = result.success ? result.data : [];
      }

      const mapped = rows.map((r) => ({
        id: parseInt(r.id),
        label: r.title,
        value: parseFloat(r.value) || 0,
        secondary: parseInt(r.secondary) || 0,
      }));
      const total = mapped.reduce((s, r) => s + r.value, 0);
      const withShare = mapped.map((r) => ({
        ...r,
        share: total > 0 ? parseFloat((r.value / total).toFixed(4)) : 0,
      }));

      return {
        success: true,
        data: { dimension: dim, rows: withShare, total },
        meta,
      };
    } catch (error) {
      logger.error("Error in getDashboardBreakdown:", error);
      return { success: false, error: "Internal server error" };
    }
  };

  /**
   * Get filter options for dropdown menus
   * 
   * Provides list of available options for filtering analytics data.
   * Used to populate dropdown menus in the frontend.
   * 
   * @param {string} type - Filter type - REQUIRED
   * @param {string} type.courses - Get list of all live courses
   * @param {string} type.bundles - Get list of all live and active bundles
   * @param {string} type.coupons - Get list of all non-deleted coupons
   * @param {string} type.users - Get list of regular users (limited to 1000)
   * @param {string} type.teachers - Get list of unique teachers from course instructor lists
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Filter options data
   * @returns {Array} returns.data.options - Array of option objects
   * @returns {number|string} returns.data.options[].id - Option ID (integer for courses/bundles/coupons/users, string for teachers)
   * @returns {string} returns.data.options[].name - Display name
   * @returns {number|string} returns.data.options[].value - Option value (same as id)
   * @returns {string} [returns.error] - Error message if success is false
   * 
   * @throws {Object} Returns error object if type is invalid
   */
  getFilterOptions = async (type, access = null) => {
    try {
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (type === "courses" && this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            options: [],
          },
        };
      }

      let query = "";
      let idField = "id";
      let nameField = "title";

      switch (type) {
        case "courses":
          query = `
            SELECT id, title as name
            FROM course
            WHERE is_live = true
            ${restricted ? "AND id = ANY($1)" : ""}
            ORDER BY title ASC
          `;
          break;
        case "bundles":
          query = `
            SELECT id, title as name
            FROM bundle
            WHERE is_live = true AND is_active = true
            ORDER BY title ASC
          `;
          break;
        case "coupons":
          query = `
            SELECT id, code as name
            FROM coupons
            WHERE status != 'deleted'
            ORDER BY code ASC
          `;
          break;
        case "users":
          query = `
            SELECT id, name
            FROM managerial_auth
            WHERE type = 3
            ORDER BY name ASC
            LIMIT 1000
          `;
          break;
        case "teachers":
          // Assuming teachers are stored in a teacher table or course.instructor_list
          query = `
            SELECT DISTINCT 
              jsonb_array_elements_text(instructor_list) as name
            FROM course
            WHERE instructor_list IS NOT NULL
              ${restricted ? "AND id = ANY($1)" : ""}
            ORDER BY name ASC
          `;
          idField = "name";
          nameField = "name";
          break;
        default:
          return {
            success: false,
            error: `Invalid filter type: ${type}`,
          };
      }

      const result = await this.query(
        query,
        restricted && (type === "courses" || type === "teachers") ? [courseIds] : []
      );

      if (!result.success) {
        return result;
      }

      const options =
        result.data && result.data.length > 0
          ? result.data.map((row) => ({
              id: type === "teachers" ? row[nameField] : parseInt(row[idField]),
              name: row[nameField],
              value: type === "teachers" ? row[nameField] : parseInt(row[idField]),
            }))
          : [];

      return {
        success: true,
        data: {
          options: options,
        },
      };
    } catch (error) {
      logger.error("Error in getFilterOptions:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };
}

module.exports = { DashboardAnalyticsService };
