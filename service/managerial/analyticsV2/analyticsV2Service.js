const Service = require("../../base").Service;
const {
  parseDateRange,
  getPreviousPeriod,
  calculateGrowthPercentage,
} = require("../../../util/analyticsV2/dateUtils");
const {
  buildDateFilter,
  buildIdFilter,
  buildPagination,
  buildOrderBy,
  validateLimit,
  validateOffset,
  combineConditions,
  buildDateGrouping,
} = require("../../../util/analyticsV2/queryUtils");

class AnalyticsV2Service extends Service {
  constructor() {
    super();
  }

  _isRestrictedAccess = (access) => {
    return !!(access && access.hasGlobalAccess === false);
  };

  _getAccessibleCourseIds = (access) => {
    if (!this._isRestrictedAccess(access)) {
      return [];
    }
    return Array.isArray(access.courseIds) ? access.courseIds : [];
  };

  _hasNoAccessibleCourses = (access) => {
    return this._isRestrictedAccess(access) && this._getAccessibleCourseIds(access).length === 0;
  };

  _appendCourseAccessCondition = (columnName, params, access) => {
    if (!this._isRestrictedAccess(access)) {
      return "";
    }

    const courseIds = this._getAccessibleCourseIds(access);
    if (courseIds.length === 0) {
      return " AND 1 = 0";
    }

    params.push(courseIds);
    return ` AND ${columnName} = ANY($${params.length})`;
  };

  _appendBundleAccessCondition = (bundleIdColumn, params, access) => {
    if (!this._isRestrictedAccess(access)) {
      return "";
    }

    const courseIds = this._getAccessibleCourseIds(access);
    if (courseIds.length === 0) {
      return " AND 1 = 0";
    }

    params.push(courseIds);
    return ` AND EXISTS (
      SELECT 1
      FROM bundle_course bac
      WHERE bac.bundle_id = ${bundleIdColumn}
        AND bac.course_id = ANY($${params.length})
    )`;
  };

  // ── Dashboard time-series helpers ─────────────────────────────────────────
  // Used by the centralized dashboard overview / timeseries endpoints to return
  // real { period, revenue, enrollments, users } curves (not just scalars).

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
      console.error("Error in getDashboardOverview:", error);
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
      console.error("Error in getDashboardTimeseries:", error);
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
      console.error("Error in getDashboardBreakdown:", error);
      return { success: false, error: "Internal server error" };
    }
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
      const dateRange = parseDateRange(startDate, endDate);
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

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

      // Build base query for revenue
      // Note: takes.timestamp is INTEGER, so compare directly
      // Filter out free enrollments (amount IS NULL or transaction_id IS NULL)
      let courseRevenueQuery = `
        SELECT COALESCE(SUM(amount), 0) as revenue
        FROM takes
        WHERE amount IS NOT NULL 
          AND transaction_id IS NOT NULL
          AND ($1::bigint IS NULL OR timestamp >= $1)
          AND ($2::bigint IS NULL OR timestamp <= $2)
      `;
      let courseParams = [dateRange.start, dateRange.end];

      if (courseId) {
        courseRevenueQuery += ` AND course_id = $${courseParams.length + 1}`;
        courseParams.push(courseId);
      }

      if (restricted) {
        courseRevenueQuery += ` AND course_id = ANY($${courseParams.length + 1})`;
        courseParams.push(courseIds);
      }

      const courseRevenueResult = await this.query(
        courseRevenueQuery,
        courseParams
      );

      // Note: bundle_purchase.timestamp is INTEGER, so compare directly
      let bundleRevenueQuery = `
        SELECT COALESCE(SUM(amount), 0) as revenue
        FROM bundle_purchase
        WHERE ($1::bigint IS NULL OR timestamp >= $1)
          AND ($2::bigint IS NULL OR timestamp <= $2)
      `;
      let bundleParams = [dateRange.start, dateRange.end];

      if (bundleId) {
        bundleRevenueQuery += ` AND bundle_id = $${bundleParams.length + 1}`;
        bundleParams.push(bundleId);
      }

      if (restricted) {
        bundleRevenueQuery += ` AND EXISTS (
          SELECT 1
          FROM bundle_course bc
          WHERE bc.bundle_id = bundle_purchase.bundle_id
            AND bc.course_id = ANY($${bundleParams.length + 1})
        )`;
        bundleParams.push(courseIds);
      }

      const bundleRevenueResult = await this.query(
        bundleRevenueQuery,
        bundleParams
      );

      // Get coupon revenue
      const couponRevenueQuery = `
        SELECT 
          COALESCE(SUM(final_price), 0) as revenue_with_coupon,
          COALESCE(SUM(discount_amount), 0) as discount_given
        FROM coupon_usage
        WHERE payment_status = 'completed'
          AND ($1::bigint IS NULL OR used_at >= $1)
          AND ($2::bigint IS NULL OR used_at <= $2)
          ${
            restricted
              ? `AND (
            (item_type = 'COURSE' AND item_id = ANY($3))
            OR
            (item_type = 'BUNDLE' AND EXISTS (
              SELECT 1
              FROM bundle_course bc
              WHERE bc.bundle_id = coupon_usage.item_id
                AND bc.course_id = ANY($3)
            ))
          )`
              : ""
          }
      `;
      const couponRevenueResult = await this.query(couponRevenueQuery, [
        dateRange.start,
        dateRange.end,
        ...(restricted ? [courseIds] : []),
      ]);

      // Get total transactions and average
      // Note: Both takes.timestamp and bundle_purchase.timestamp are INTEGER, so compare directly
      const totalTransactionsQuery = `
        SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(amount), 0) as total_revenue
        FROM (
          SELECT amount FROM takes
          WHERE amount IS NOT NULL 
            AND transaction_id IS NOT NULL
            AND ($1::bigint IS NULL OR timestamp >= $1)
            AND ($2::bigint IS NULL OR timestamp <= $2)
            ${restricted ? "AND course_id = ANY($5)" : ""}
          UNION ALL
          SELECT amount FROM bundle_purchase
          WHERE ($3::bigint IS NULL OR timestamp >= $3)
            AND ($4::bigint IS NULL OR timestamp <= $4)
            ${
              restricted
                ? "AND EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = bundle_purchase.bundle_id AND bc.course_id = ANY($5))"
                : ""
            }
        ) as all_transactions
      `;
      const totalTransactionsResult = await this.query(
        totalTransactionsQuery,
        [
          dateRange.start,
          dateRange.end,
          dateRange.start,
          dateRange.end,
          ...(restricted ? [courseIds] : []),
        ]
      );

      const courseRevenue =
        courseRevenueResult.success && courseRevenueResult.data[0]
          ? parseFloat(courseRevenueResult.data[0].revenue)
          : 0;
      const bundleRevenue =
        bundleRevenueResult.success && bundleRevenueResult.data[0]
          ? parseFloat(bundleRevenueResult.data[0].revenue)
          : 0;
      const totalRevenue = courseRevenue + bundleRevenue;

      const couponData =
        couponRevenueResult.success && couponRevenueResult.data[0]
          ? {
              revenue_with_coupon: parseFloat(
                couponRevenueResult.data[0].revenue_with_coupon
              ),
              discount_given: parseFloat(
                couponRevenueResult.data[0].discount_given
              ),
            }
          : { revenue_with_coupon: 0, discount_given: 0 };

      const transactionsData =
        totalTransactionsResult.success && totalTransactionsResult.data[0]
          ? {
              total_transactions: parseInt(
                totalTransactionsResult.data[0].total_transactions
              ),
              total_revenue: parseFloat(
                totalTransactionsResult.data[0].total_revenue
              ),
            }
          : { total_transactions: 0, total_revenue: 0 };

      const averageOrderValue =
        transactionsData.total_transactions > 0
          ? parseFloat(
              (
                transactionsData.total_revenue /
                transactionsData.total_transactions
              ).toFixed(2)
            )
          : 0;

      // Get trends if groupBy is provided
      // Note: takes.timestamp is INTEGER, DATE_TRUNC needs timestamp conversion
      let trends = [];
      if (groupBy) {
        const trendsQuery = `
          SELECT 
            ${buildDateGrouping(groupBy, "timestamp", true)} as period,
            COALESCE(SUM(amount), 0) as revenue,
            COUNT(*) as enrollments
        FROM takes
        WHERE ($1::bigint IS NULL OR timestamp >= $1)
          AND ($2::bigint IS NULL OR timestamp <= $2)
          ${restricted ? "AND course_id = ANY($3)" : ""}
          GROUP BY period
          ORDER BY period ASC
        `;
        const trendsResult = await this.query(trendsQuery, [
          dateRange.start,
          dateRange.end,
          ...(restricted ? [courseIds] : []),
        ]);

        if (trendsResult.success && trendsResult.data) {
          trends = trendsResult.data.map((t) => ({
            period: t.period
              ? new Date(t.period).toISOString().split("T")[0]
              : null,
            revenue: parseFloat(t.revenue),
            enrollments: parseInt(t.enrollments),
          }));
        }
      }

      return {
        success: true,
        data: {
          total_revenue: totalRevenue,
          course_revenue: courseRevenue,
          bundle_revenue: bundleRevenue,
          with_coupon_revenue: couponData.revenue_with_coupon,
          without_coupon_revenue: totalRevenue - couponData.discount_given,
          discount_given: couponData.discount_given,
          average_order_value: averageOrderValue,
          total_transactions: transactionsData.total_transactions,
          trends: trends,
        },
      };
    } catch (error) {
      console.error("Error in getRevenueSummary:", error);
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
      const { startDate, endDate, groupBy = "day", courseId, bundleId } =
        filters;
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (!startDate || !endDate) {
        return {
          success: false,
          error: "start_date and end_date are required",
        };
      }

      const dateRange = parseDateRange(startDate, endDate);

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

      // Get course revenue trends
      // Note: takes.timestamp is INTEGER, so compare directly
      // Filter out free enrollments (amount IS NULL or transaction_id IS NULL)
      let courseTrendsQuery = `
        SELECT 
          ${buildDateGrouping(groupBy, "timestamp", true)} as period,
          COALESCE(SUM(amount), 0) as revenue,
          COUNT(*) as enrollments
        FROM takes
        WHERE amount IS NOT NULL 
          AND transaction_id IS NOT NULL
          AND timestamp >= $1
          AND timestamp <= $2
      `;
      let courseParams = [dateRange.start, dateRange.end];

      if (courseId) {
        courseTrendsQuery += ` AND course_id = $${courseParams.length + 1}`;
        courseParams.push(courseId);
      }

      if (restricted) {
        courseTrendsQuery += ` AND course_id = ANY($${courseParams.length + 1})`;
        courseParams.push(courseIds);
      }

      courseTrendsQuery += ` GROUP BY period ORDER BY period ASC`;

      const courseTrendsResult = await this.query(
        courseTrendsQuery,
        courseParams
      );

      // Get bundle revenue trends
      // Note: bundle_purchase.timestamp is INTEGER, DATE_TRUNC needs timestamp conversion
      let bundleTrendsQuery = `
        SELECT 
          ${buildDateGrouping(groupBy, "timestamp", true)} as period,
          COALESCE(SUM(amount), 0) as revenue,
          COUNT(*) as purchases
        FROM bundle_purchase
        WHERE timestamp >= $1
          AND timestamp <= $2
      `;
      let bundleParams = [dateRange.start, dateRange.end];

      if (bundleId) {
        bundleTrendsQuery += ` AND bundle_id = $${bundleParams.length + 1}`;
        bundleParams.push(bundleId);
      }

      if (restricted) {
        bundleTrendsQuery += ` AND EXISTS (
          SELECT 1
          FROM bundle_course bc
          WHERE bc.bundle_id = bundle_purchase.bundle_id
            AND bc.course_id = ANY($${bundleParams.length + 1})
        )`;
        bundleParams.push(courseIds);
      }

      bundleTrendsQuery += ` GROUP BY period ORDER BY period ASC`;

      const bundleTrendsResult = await this.query(
        bundleTrendsQuery,
        bundleParams
      );

      // Combine trends
      const trendsMap = new Map();

      if (courseTrendsResult.success && courseTrendsResult.data) {
        courseTrendsResult.data.forEach((t) => {
          const period = t.period
            ? new Date(t.period).toISOString().split("T")[0]
            : null;
          if (period) {
            trendsMap.set(period, {
              period,
              revenue: parseFloat(t.revenue),
              enrollments: parseInt(t.enrollments),
              course_revenue: parseFloat(t.revenue),
              bundle_revenue: 0,
            });
          }
        });
      }

      if (bundleTrendsResult.success && bundleTrendsResult.data) {
        bundleTrendsResult.data.forEach((t) => {
          const period = t.period
            ? new Date(t.period).toISOString().split("T")[0]
            : null;
          if (period) {
            const existing = trendsMap.get(period);
            if (existing) {
              existing.bundle_revenue = parseFloat(t.revenue);
              existing.revenue += parseFloat(t.revenue);
            } else {
              trendsMap.set(period, {
                period,
                revenue: parseFloat(t.revenue),
                enrollments: 0,
                course_revenue: 0,
                bundle_revenue: parseFloat(t.revenue),
              });
            }
          }
        });
      }

      const trends = Array.from(trendsMap.values()).sort((a, b) =>
        a.period.localeCompare(b.period)
      );

      const totalRevenue = trends.reduce((sum, t) => sum + t.revenue, 0);
      const averageDailyRevenue =
        trends.length > 0 ? parseFloat((totalRevenue / trends.length).toFixed(2)) : 0;

      return {
        success: true,
        data: {
          trends: trends,
          summary: {
            total_revenue: totalRevenue,
            average_daily_revenue: averageDailyRevenue,
          },
        },
      };
    } catch (error) {
      console.error("Error in getRevenueTrends:", error);
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
      const {
        startDate,
        endDate,
        limit = 20,
        offset = 0,
        sortBy = "revenue",
        order = "desc",
      } = filters;

      const dateRange = parseDateRange(startDate, endDate);
      const validLimit = validateLimit(limit);
      const validOffset = validateOffset(offset);
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            courses: [],
            meta: {
              total: 0,
              limit: validLimit,
              offset: validOffset,
            },
          },
        };
      }

      const sortColumn =
        sortBy === "enrollments" ? "enrollments" : "revenue";
      const orderBy = buildOrderBy(sortColumn, order);

      const queryParams = [dateRange.start, dateRange.end];
      let courseScopeWhere = "";

      if (restricted) {
        queryParams.push(courseIds);
        courseScopeWhere = `WHERE c.id = ANY($${queryParams.length})`;
      }

      queryParams.push(validLimit);
      queryParams.push(validOffset);

      // Note: takes.timestamp is INTEGER, so compare directly
      const query = `
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
        ${courseScopeWhere}
        GROUP BY c.id, c.title
        ${orderBy}
        LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
      `;

      const result = await this.query(query, queryParams);

      // Get total count
      // Note: takes.timestamp is INTEGER, so compare directly
      const countQuery = `
        SELECT COUNT(DISTINCT c.id) as total
        FROM course c
        LEFT JOIN takes t ON c.id = t.course_id
          AND ($1::bigint IS NULL OR t.timestamp >= $1)
          AND ($2::bigint IS NULL OR t.timestamp <= $2)
        ${restricted ? "WHERE c.id = ANY($3)" : ""}
      `;
      const countResult = await this.query(countQuery, [
        dateRange.start,
        dateRange.end,
        ...(restricted ? [courseIds] : []),
      ]);

      const total =
        countResult.success && countResult.data[0]
          ? parseInt(countResult.data[0].total)
          : 0;

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: {
          courses:
            result.data && result.data.length > 0
              ? result.data.map((c) => ({
                  course_id: parseInt(c.course_id),
                  title: c.title,
                  revenue: parseFloat(c.revenue),
                  enrollments: parseInt(c.enrollments),
                  average_revenue_per_student: parseFloat(
                    c.average_revenue_per_student
                  ),
                  with_coupon_revenue: parseFloat(c.with_coupon_revenue),
                  without_coupon_revenue: parseFloat(c.without_coupon_revenue),
                }))
              : [],
          meta: {
            total: total,
            limit: validLimit,
            offset: validOffset,
          },
        },
      };
    } catch (error) {
      console.error("Error in getRevenueByCourse:", error);
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
      const {
        startDate,
        endDate,
        limit = 20,
        offset = 0,
        sortBy = "revenue",
        order = "desc",
      } = filters;

      const dateRange = parseDateRange(startDate, endDate);
      const validLimit = validateLimit(limit);
      const validOffset = validateOffset(offset);
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            bundles: [],
            meta: {
              total: 0,
              limit: validLimit,
              offset: validOffset,
            },
          },
        };
      }

      const sortColumn =
        sortBy === "purchases" ? "purchases" : "revenue";
      const orderBy = buildOrderBy(sortColumn, order);

      // Note: bundle_purchase.timestamp is INTEGER, so compare directly
      const query = `
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
        ${
          restricted
            ? "WHERE EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = b.id AND bc.course_id = ANY($5))"
            : ""
        }
        GROUP BY b.id, b.title
        ${orderBy}
        LIMIT $3 OFFSET $4
      `;

      const result = await this.query(query, [
        dateRange.start,
        dateRange.end,
        validLimit,
        validOffset,
        ...(restricted ? [courseIds] : []),
      ]);

      // Get total count
      // Note: bundle_purchase.timestamp is INTEGER, so compare directly
      const countQuery = `
        SELECT COUNT(DISTINCT b.id) as total
        FROM bundle b
        LEFT JOIN bundle_purchase bp ON b.id = bp.bundle_id
          AND ($1::bigint IS NULL OR bp.timestamp >= $1)
          AND ($2::bigint IS NULL OR bp.timestamp <= $2)
        ${
          restricted
            ? "WHERE EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = b.id AND bc.course_id = ANY($3))"
            : ""
        }
      `;
      const countResult = await this.query(countQuery, [
        dateRange.start,
        dateRange.end,
        ...(restricted ? [courseIds] : []),
      ]);

      const total =
        countResult.success && countResult.data[0]
          ? parseInt(countResult.data[0].total)
          : 0;

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: {
          bundles:
            result.data && result.data.length > 0
              ? result.data.map((b) => ({
                  bundle_id: parseInt(b.bundle_id),
                  title: b.title,
                  revenue: parseFloat(b.revenue),
                  purchases: parseInt(b.purchases),
                  average_revenue_per_purchase: parseFloat(
                    b.average_revenue_per_purchase
                  ),
                  with_coupon_revenue: parseFloat(b.with_coupon_revenue),
                  without_coupon_revenue: parseFloat(b.without_coupon_revenue),
                }))
              : [],
          meta: {
            total: total,
            limit: validLimit,
            offset: validOffset,
          },
        },
      };
    } catch (error) {
      console.error("Error in getRevenueByBundle:", error);
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
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (!["week", "month", "quarter", "year"].includes(period)) {
        return {
          success: false,
          error: "Invalid period. Must be: week, month, quarter, or year",
        };
      }

      const now = Math.floor(Date.now() / 1000);
      let historicalPeriods = 6; // Look at last 6 periods
      let periodSeconds = 0;

      switch (period) {
        case "week":
          periodSeconds = 7 * 86400;
          break;
        case "month":
          periodSeconds = 30 * 86400;
          break;
        case "quarter":
          periodSeconds = 90 * 86400;
          break;
        case "year":
          periodSeconds = 365 * 86400;
          historicalPeriods = 3; // Look at last 3 years
          break;
      }

      // Get historical revenue for last N periods
      // Note: Both takes.timestamp and bundle_purchase.timestamp are INTEGER, so compare directly
      // Filter out free enrollments from takes
      const historicalQuery = `
        SELECT 
          COALESCE(SUM(amount), 0) as revenue
        FROM (
          SELECT amount, timestamp FROM takes
          WHERE amount IS NOT NULL AND transaction_id IS NOT NULL
            ${restricted ? "AND course_id = ANY($3)" : ""}
          UNION ALL
          SELECT amount, timestamp FROM bundle_purchase
          ${
            restricted
              ? "WHERE EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = bundle_purchase.bundle_id AND bc.course_id = ANY($3))"
              : ""
          }
        ) as all_transactions
        WHERE timestamp >= $1
          AND timestamp <= $2
      `;

      const historicalRevenues = [];
      for (let i = historicalPeriods; i >= 1; i--) {
        const periodStart = now - i * periodSeconds;
        const periodEnd = now - (i - 1) * periodSeconds;

        const result = await this.query(
          historicalQuery,
          restricted
            ? [periodStart, periodEnd, courseIds]
            : [periodStart, periodEnd]
        );

        if (result.success && result.data[0]) {
          historicalRevenues.push(parseFloat(result.data[0].revenue));
        }
      }

      if (historicalRevenues.length === 0) {
        return {
          success: false,
          error: "Insufficient historical data for prediction",
        };
      }

      let predictedRevenue = 0;
      let confidence = "low";
      let growthRate = 0;

      if (method === "average") {
        // Simple average
        const sum = historicalRevenues.reduce((a, b) => a + b, 0);
        predictedRevenue = parseFloat((sum / historicalRevenues.length).toFixed(2));
        confidence = historicalRevenues.length >= 4 ? "medium" : "low";
      } else if (method === "trend") {
        // Simple linear trend
        if (historicalRevenues.length >= 2) {
          const recent = historicalRevenues.slice(-3);
          const older = historicalRevenues.slice(0, -3);
          const recentAvg =
            recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg =
            older.length > 0
              ? older.reduce((a, b) => a + b, 0) / older.length
              : recentAvg;

          growthRate =
            olderAvg > 0
              ? parseFloat(
                  (((recentAvg - olderAvg) / olderAvg) * 100).toFixed(2)
                )
              : 0;

          predictedRevenue = parseFloat(
            (recentAvg * (1 + growthRate / 100)).toFixed(2)
          );
          confidence = historicalRevenues.length >= 4 ? "medium" : "low";
        } else {
          // Fallback to average
          const sum = historicalRevenues.reduce((a, b) => a + b, 0);
          predictedRevenue = parseFloat((sum / historicalRevenues.length).toFixed(2));
          confidence = "low";
        }
      }

      const periodName = `next_${period}`;

      return {
        success: true,
        data: {
          prediction: {
            period: periodName,
            predicted_revenue: predictedRevenue,
            confidence: confidence,
            method: method,
            based_on: {
              historical_periods: historicalRevenues.length,
              average_revenue:
                historicalRevenues.reduce((a, b) => a + b, 0) /
                historicalRevenues.length,
              growth_rate: growthRate,
            },
          },
          disclaimer:
            "Predictions are based on simple historical averages and trends. Actual results may vary.",
        },
      };
    } catch (error) {
      console.error("Error in getRevenuePredictions:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get comprehensive user overview statistics
   * 
   * Provides user metrics including:
   * - Total user counts (regular users, admins)
   * - New user registrations (today, this month, in date range)
   * - Active users (7 days, 30 days)
   * - Paying users and conversion rate
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - User overview data
   * @returns {number} returns.data.total_users - Total number of users
   * @returns {number} returns.data.regular_users - Number of regular users (type 3)
   * @returns {number} returns.data.admins - Number of admin users (type 1, 2)
   * @returns {number} returns.data.new_users_today - New users registered today
   * @returns {number} returns.data.new_users_this_month - New users registered this month
   * @returns {number} returns.data.new_users_in_range - New users in specified date range
   * @returns {number} returns.data.active_users_7d - Users active in last 7 days
   * @returns {number} returns.data.active_users_30d - Users active in last 30 days
   * @returns {number} returns.data.paying_users - Users who have made at least one purchase
   * @returns {number} returns.data.conversion_rate - Percentage of regular users who are paying users
   * @returns {string} [returns.error] - Error message if success is false
   */
  getUserOverview = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate } = filters;
      const dateRange = parseDateRange(startDate, endDate);
      const now = Math.floor(Date.now() / 1000);
      const day = 86400;
      const last7Days = now - 7 * day;
      const last30Days = now - 30 * day;

      // Get total users
      const totalUsersQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE type = 3) as regular_users,
          COUNT(*) FILTER (WHERE type IN (1, 2)) as admins,
          COUNT(*) as total_users
        FROM managerial_auth
      `;
      const totalUsersResult = await this.query(totalUsersQuery, []);

      // Get new users in date range
      // Note: managerial_auth.created_at is TIMESTAMP, so use to_timestamp()
      const newUsersQuery = `
        SELECT COUNT(*) as count
        FROM managerial_auth
        WHERE type = 3
          AND ($1::bigint IS NULL OR created_at >= to_timestamp($1))
          AND ($2::bigint IS NULL OR created_at <= to_timestamp($2))
      `;
      const newUsersResult = await this.query(newUsersQuery, [
        dateRange.start,
        dateRange.end,
      ]);

      // Get active users
      // Note: progress.timestamp is INTEGER, so compare directly
      const activeUsers7dQuery = `
        SELECT COUNT(DISTINCT user_id) as count
        FROM progress
        WHERE timestamp >= $1
      `;
      const activeUsers7dResult = await this.query(activeUsers7dQuery, [
        last7Days,
      ]);

      const activeUsers30dQuery = `
        SELECT COUNT(DISTINCT user_id) as count
        FROM progress
        WHERE timestamp >= $1
      `;
      const activeUsers30dResult = await this.query(activeUsers30dQuery, [
        last30Days,
      ]);

      // Get paying users (no date filter needed)
      const payingUsersQuery = `
        SELECT COUNT(DISTINCT user_id) as count
        FROM takes
      `;
      const payingUsersResult = await this.query(payingUsersQuery, []);

      const totalUsers =
        totalUsersResult.success && totalUsersResult.data[0]
          ? {
              total: parseInt(totalUsersResult.data[0].total_users),
              regular: parseInt(totalUsersResult.data[0].regular_users),
              admins: parseInt(totalUsersResult.data[0].admins),
            }
          : { total: 0, regular: 0, admins: 0 };

      const newUsers =
        newUsersResult.success && newUsersResult.data[0]
          ? parseInt(newUsersResult.data[0].count)
          : 0;

      const activeUsers7d =
        activeUsers7dResult.success && activeUsers7dResult.data[0]
          ? parseInt(activeUsers7dResult.data[0].count)
          : 0;

      const activeUsers30d =
        activeUsers30dResult.success && activeUsers30dResult.data[0]
          ? parseInt(activeUsers30dResult.data[0].count)
          : 0;

      const payingUsers =
        payingUsersResult.success && payingUsersResult.data[0]
          ? parseInt(payingUsersResult.data[0].count)
          : 0;

      const conversionRate =
        totalUsers.regular > 0
          ? parseFloat(((payingUsers / totalUsers.regular) * 100).toFixed(2))
          : 0;

      // Get today's new users
      // Note: managerial_auth.created_at is TIMESTAMP, so use to_timestamp()
      const todayStart = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000);
      const todayUsersQuery = `
        SELECT COUNT(*) as count
        FROM managerial_auth
        WHERE type = 3
          AND created_at >= to_timestamp($1)
      `;
      const todayUsersResult = await this.query(todayUsersQuery, [todayStart]);
      const newUsersToday =
        todayUsersResult.success && todayUsersResult.data[0]
          ? parseInt(todayUsersResult.data[0].count)
          : 0;

      // Get this month's new users
      // Note: managerial_auth.created_at is TIMESTAMP, so use to_timestamp()
      const monthStart = Math.floor(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() /
          1000
      );
      const monthUsersQuery = `
        SELECT COUNT(*) as count
        FROM managerial_auth
        WHERE type = 3
          AND created_at >= to_timestamp($1)
      `;
      const monthUsersResult = await this.query(monthUsersQuery, [monthStart]);
      const newUsersThisMonth =
        monthUsersResult.success && monthUsersResult.data[0]
          ? parseInt(monthUsersResult.data[0].count)
          : 0;

      return {
        success: true,
        data: {
          total_users: totalUsers.total,
          regular_users: totalUsers.regular,
          admins: totalUsers.admins,
          new_users_today: newUsersToday,
          new_users_this_month: newUsersThisMonth,
          new_users_in_range: newUsers,
          active_users_7d: activeUsers7d,
          active_users_30d: activeUsers30d,
          paying_users: payingUsers,
          conversion_rate: conversionRate,
        },
      };
    } catch (error) {
      console.error("Error in getUserOverview:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get user growth trends over time
   * 
   * Provides time-series user growth data showing:
   * - New user registrations per period
   * - Total users per period
   * - Paying users per period
   * 
   * @param {Object} filters - Filter options
   * @param {number} filters.startDate - Start date as Unix timestamp (seconds) - REQUIRED
   * @param {number} filters.endDate - End date as Unix timestamp (seconds) - REQUIRED
   * @param {string} [filters.groupBy='month'] - Group by: 'day', 'week', 'month', 'quarter', 'year'
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - User growth data
   * @returns {Array} returns.data.growth - Array of growth objects per period
   * @returns {string} returns.data.growth[].period - Period identifier (YYYY-MM-DD format)
   * @returns {number} returns.data.growth[].new_users - New users registered in period
   * @returns {number} returns.data.growth[].total_users - Total users at end of period
   * @returns {number} returns.data.growth[].paying_users - Paying users in period
   * @returns {Object} returns.data.summary - Summary statistics
   * @returns {number} returns.data.summary.total_new_users - Total new users across all periods
   * @returns {number} returns.data.summary.average_daily_new_users - Average new users per period
   * @returns {string} [returns.error] - Error message if success is false
   * 
   * @throws {Object} Returns error object if startDate or endDate is missing
   */
  getUserGrowth = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, groupBy = "month" } = filters;

      if (!startDate || !endDate) {
        return {
          success: false,
          error: "start_date and end_date are required",
        };
      }

      const dateRange = parseDateRange(startDate, endDate);

      // Ensure we have valid timestamps
      if (!dateRange.start || !dateRange.end) {
        return {
          success: false,
          error: "Invalid date range",
        };
      }

      // Note: managerial_auth.created_at is TIMESTAMP type
      // Use to_timestamp() for comparison with Unix timestamps
      // DATE_TRUNC works directly on TIMESTAMP columns (no conversion needed)
      const query = `
        SELECT 
          ${buildDateGrouping(groupBy, "created_at", false)} as period,
          COUNT(*) FILTER (WHERE type = 3) as new_users,
          COUNT(*) as total_users
        FROM managerial_auth
        WHERE created_at >= to_timestamp($1::bigint)
          AND created_at <= to_timestamp($2::bigint)
        GROUP BY period
        ORDER BY period ASC
      `;

      const result = await this.query(query, [
        parseInt(dateRange.start),
        parseInt(dateRange.end),
      ]);

      // Get paying users per period
      // Note: takes.timestamp is INTEGER, DATE_TRUNC needs timestamp conversion
      // Filter out free enrollments (amount IS NULL or transaction_id IS NULL)
      const payingUsersQuery = `
        SELECT 
          ${buildDateGrouping(groupBy, "timestamp", true)} as period,
          COUNT(DISTINCT user_id) as paying_users
        FROM takes
        WHERE amount IS NOT NULL 
          AND transaction_id IS NOT NULL
          AND timestamp >= $1
          AND timestamp <= $2
        GROUP BY period
        ORDER BY period ASC
      `;

      const payingUsersResult = await this.query(payingUsersQuery, [
        dateRange.start,
        dateRange.end,
      ]);

      // Combine data
      const growthMap = new Map();

      if (result.success && result.data) {
        result.data.forEach((row) => {
          const period = row.period
            ? new Date(row.period).toISOString().split("T")[0]
            : null;
          if (period) {
            growthMap.set(period, {
              period,
              new_users: parseInt(row.new_users),
              total_users: parseInt(row.total_users),
              paying_users: 0,
            });
          }
        });
      }

      if (payingUsersResult.success && payingUsersResult.data) {
        payingUsersResult.data.forEach((row) => {
          const period = row.period
            ? new Date(row.period).toISOString().split("T")[0]
            : null;
          if (period) {
            const existing = growthMap.get(period);
            if (existing) {
              existing.paying_users = parseInt(row.paying_users);
            } else {
              growthMap.set(period, {
                period,
                new_users: 0,
                total_users: 0,
                paying_users: parseInt(row.paying_users),
              });
            }
          }
        });
      }

      const growth = Array.from(growthMap.values()).sort((a, b) =>
        a.period.localeCompare(b.period)
      );

      const totalNewUsers = growth.reduce((sum, g) => sum + g.new_users, 0);
      const averageDailyNewUsers =
        growth.length > 0
          ? parseFloat((totalNewUsers / growth.length).toFixed(2))
          : 0;

      return {
        success: true,
        data: {
          growth: growth,
          summary: {
            total_new_users: totalNewUsers,
            average_daily_new_users: averageDailyNewUsers,
          },
        },
      };
    } catch (error) {
      console.error("Error in getUserGrowth:", error);
      return {
        success: false,
        error: "Internal server error",
      };
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
      console.error("Error in getFilterOptions:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get user engagement metrics and activity statistics
   * 
   * Provides engagement analytics including:
   * - Active users (7 days, 30 days)
   * - Users with progress and submissions
   * - Average modules completed
   * - Average streak days
   * 
   * Can be filtered by specific user for individual engagement analysis.
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * @param {number} [filters.userId] - Filter by specific user ID
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Engagement data
   * @returns {number} returns.data.active_users_7d - Users active in last 7 days
   * @returns {number} returns.data.active_users_30d - Users active in last 30 days
   * @returns {number} returns.data.users_with_progress - Users who have made progress
   * @returns {number} returns.data.users_with_submissions - Users who have submitted assignments
   * @returns {number} returns.data.average_modules_completed - Average modules completed per user
   * @returns {number} returns.data.average_streak_days - Average learning streak days
   * @returns {string} [returns.error] - Error message if success is false
   */
  getUserEngagement = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, userId } = filters;
      const dateRange = parseDateRange(startDate, endDate);
      const now = Math.floor(Date.now() / 1000);
      const day = 86400;
      const last7Days = now - 7 * day;
      const last30Days = now - 30 * day;

      let userFilter = "";
      const params = [];
      if (userId) {
        userFilter = "AND user_id = $1";
        params.push(userId);
      }

      // Active users
      // Note: progress.timestamp is INTEGER, so compare directly
      const activeUsers7dQuery = `
        SELECT COUNT(DISTINCT user_id) as count
        FROM progress
        WHERE timestamp >= $${params.length + 1}
          ${userFilter}
      `;
      const activeUsers7dResult = await this.query(
        activeUsers7dQuery,
        [...params, last7Days]
      );

      const activeUsers30dQuery = `
        SELECT COUNT(DISTINCT user_id) as count
        FROM progress
        WHERE timestamp >= $${params.length + 1}
          ${userFilter}
      `;
      const activeUsers30dResult = await this.query(
        activeUsers30dQuery,
        [...params, last30Days]
      );

      // Users with progress
      // Note: progress.timestamp is INTEGER, so compare directly
      const usersWithProgressQuery = `
        SELECT COUNT(DISTINCT user_id) as count
        FROM progress
        WHERE ($1::bigint IS NULL OR timestamp >= $1)
          AND ($2::bigint IS NULL OR timestamp <= $2)
          ${userFilter.replace("$1", `$${params.length + 3}`)}
      `;
      const usersWithProgressResult = await this.query(
        usersWithProgressQuery,
        [
          ...params,
          dateRange.start,
          dateRange.end,
        ]
      );

      // Average modules completed
      // Note: progress.timestamp is INTEGER, so compare directly
      const avgModulesQuery = `
        SELECT 
          COUNT(DISTINCT module_id)::numeric / NULLIF(COUNT(DISTINCT user_id), 0) as avg_modules
        FROM progress
        WHERE ($1::bigint IS NULL OR timestamp >= $1)
          AND ($2::bigint IS NULL OR timestamp <= $2)
          ${userFilter.replace("$1", `$${params.length + 3}`)}
      `;
      const avgModulesResult = await this.query(avgModulesQuery, [
        ...params,
        dateRange.start,
        dateRange.end,
      ]);

      // Average streak days
      const avgStreakQuery = `
        SELECT AVG(current_streak) as avg_streak
        FROM user_course_streaks
        ${userId ? `WHERE user_id = $1` : ""}
      `;
      const avgStreakResult = await this.query(
        avgStreakQuery,
        userId ? [userId] : []
      );

      return {
        success: true,
        data: {
          active_users_7d:
            activeUsers7dResult.success && activeUsers7dResult.data[0]
              ? parseInt(activeUsers7dResult.data[0].count)
              : 0,
          active_users_30d:
            activeUsers30dResult.success && activeUsers30dResult.data[0]
              ? parseInt(activeUsers30dResult.data[0].count)
              : 0,
          users_with_progress:
            usersWithProgressResult.success && usersWithProgressResult.data[0]
              ? parseInt(usersWithProgressResult.data[0].count)
              : 0,
          average_modules_completed:
            avgModulesResult.success && avgModulesResult.data[0]
              ? parseFloat(avgModulesResult.data[0].avg_modules || 0)
              : 0,
          average_streak_days:
            avgStreakResult.success && avgStreakResult.data[0]
              ? parseFloat(avgStreakResult.data[0].avg_streak || 0)
              : 0,
        },
      };
    } catch (error) {
      console.error("Error in getUserEngagement:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get comprehensive course overview statistics
   * 
   * Provides course analytics including:
   * - Total and live course counts
   * - Total enrollments and average enrollments per course
   * - Top performing courses with revenue and completion rates
   * 
   * Can be filtered by specific course for detailed view.
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * @param {number} [filters.courseId] - Filter by specific course ID
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Course overview data
   * @returns {number} returns.data.total_courses - Total number of courses
   * @returns {number} returns.data.live_courses - Number of live courses
   * @returns {number} returns.data.total_enrollments - Total enrollments across all courses
   * @returns {number} returns.data.average_enrollments_per_course - Average enrollments per course
   * @returns {Array} returns.data.top_courses - Top 10 courses by revenue
   * @returns {number} returns.data.top_courses[].course_id - Course ID
   * @returns {string} returns.data.top_courses[].title - Course title
   * @returns {number} returns.data.top_courses[].enrollments - Number of enrollments
   * @returns {number} returns.data.top_courses[].revenue - Total revenue
   * @returns {number} returns.data.top_courses[].completion_rate - Completion rate percentage
   * @returns {string} [returns.error] - Error message if success is false
   */
  getCourseOverview = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, courseId } = filters;
      const dateRange = parseDateRange(startDate, endDate);

      // Check course access for users with .own permission
      if (access && !access.hasGlobalAccess) {
        if (!access.courseIds || access.courseIds.length === 0) {
          // User has .own permission but no course access - return empty result
          return {
            success: true,
            data: {
              total_courses: 0,
              live_courses: 0,
              total_enrollments: 0,
              average_enrollments_per_course: 0,
              top_courses: [],
            },
          };
        }
      }

      let courseFilter = "";
      const params = [];
      if (courseId) {
        courseFilter = "WHERE c.id = $1";
        params.push(courseId);
      } else if (access && !access.hasGlobalAccess && access.courseIds) {
        // Filter by accessible courses for .own permission
        courseFilter = "WHERE c.is_live = true AND c.id = ANY($1)";
        params.push(access.courseIds);
      } else {
        courseFilter = "WHERE c.is_live = true";
      }

      // Get course statistics
      // Note: takes.timestamp is INTEGER, so compare directly
      const courseStatsQuery = `
        SELECT 
          COUNT(DISTINCT c.id) as total_courses,
          COUNT(DISTINCT CASE WHEN c.is_live = true THEN c.id END) as live_courses,
          COUNT(DISTINCT t.user_id) as total_enrollments,
          CASE 
            WHEN COUNT(DISTINCT c.id) > 0 
            THEN ROUND(COUNT(DISTINCT t.user_id)::numeric / COUNT(DISTINCT c.id), 2)
            ELSE 0
          END as average_enrollments_per_course
        FROM course c
        LEFT JOIN takes t ON c.id = t.course_id
          AND t.amount IS NOT NULL
          AND t.transaction_id IS NOT NULL
          AND ($${params.length + 1}::bigint IS NULL OR t.timestamp >= $${params.length + 1})
          AND ($${params.length + 2}::bigint IS NULL OR t.timestamp <= $${params.length + 2})
        ${courseFilter}
      `;
      const courseStatsResult = await this.query(courseStatsQuery, [
        ...params,
        dateRange.start,
        dateRange.end,
      ]);

      // Get top courses
      // Note: takes.timestamp is INTEGER, so compare directly
      const topCoursesQuery = `
        SELECT 
          c.id as course_id,
          c.title,
          COUNT(DISTINCT t.user_id) as enrollments,
          COALESCE(SUM(t.amount), 0) as revenue,
          CASE 
            WHEN COUNT(DISTINCT t.user_id) > 0 
            THEN ROUND(
              (SELECT COUNT(DISTINCT p.user_id) 
               FROM progress p
               JOIN module m ON p.module_id = m.id
               JOIN chapter ch ON m.chapter_id = ch.id
               WHERE ch.course_id = c.id)::numeric / 
              COUNT(DISTINCT t.user_id)::numeric * 100, 2
            )
            ELSE 0
          END as completion_rate
        FROM course c
        LEFT JOIN takes t ON c.id = t.course_id
          AND ($${params.length + 1}::bigint IS NULL OR t.timestamp >= $${params.length + 1})
          AND ($${params.length + 2}::bigint IS NULL OR t.timestamp <= $${params.length + 2})
        ${courseFilter}
        GROUP BY c.id, c.title
        ORDER BY revenue DESC
        LIMIT 10
      `;
      const topCoursesResult = await this.query(topCoursesQuery, [
        ...params,
        dateRange.start,
        dateRange.end,
      ]);

      const stats =
        courseStatsResult.success && courseStatsResult.data[0]
          ? {
              total_courses: parseInt(courseStatsResult.data[0].total_courses),
              live_courses: parseInt(courseStatsResult.data[0].live_courses),
              total_enrollments: parseInt(
                courseStatsResult.data[0].total_enrollments
              ),
              average_enrollments_per_course: parseFloat(
                courseStatsResult.data[0].average_enrollments_per_course
              ),
            }
          : {
              total_courses: 0,
              live_courses: 0,
              total_enrollments: 0,
              average_enrollments_per_course: 0,
            };

      return {
        success: true,
        data: {
          ...stats,
          top_courses:
            topCoursesResult.success && topCoursesResult.data
              ? topCoursesResult.data.map((c) => ({
                  course_id: parseInt(c.course_id),
                  title: c.title,
                  enrollments: parseInt(c.enrollments),
                  revenue: parseFloat(c.revenue),
                  completion_rate: parseFloat(c.completion_rate || 0),
                }))
              : [],
        },
      };
    } catch (error) {
      console.error("Error in getCourseOverview:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get detailed analytics for a specific course
   * 
   * Provides comprehensive analytics for a single course including:
   * - Course information (id, title, price)
   * - Enrollment trends (total, this month, last month, growth)
   * - Revenue breakdown (total, this month, last month)
   * - Completion statistics (total enrolled, completed, in progress, not started, completion rate)
   * - Engagement metrics (submissions, average streak)
   * 
   * @param {number} courseId - Course ID - REQUIRED
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Course detailed data
   * @returns {Object} returns.data.course - Course information
   * @returns {number} returns.data.course.id - Course ID
   * @returns {string} returns.data.course.title - Course title
   * @returns {number} returns.data.course.price - Course price
   * @returns {Object} returns.data.enrollments - Enrollment statistics
   * @returns {Object} returns.data.revenue - Revenue statistics
   * @returns {Object} returns.data.completion - Completion statistics
   * @returns {Object} returns.data.engagement - Engagement statistics
   * @returns {string} [returns.error] - Error message if success is false
   * 
   * @throws {Object} Returns error object if course is not found
   */
  getCourseDetailed = async (courseId, filters = {}, access = null) => {
    try {
      const { startDate, endDate } = filters;
      const dateRange = parseDateRange(startDate, endDate);
      const now = Math.floor(Date.now() / 1000);
      const monthStart = Math.floor(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() /
          1000
      );
      const lastMonthStart = Math.floor(
        new Date(
          new Date().getFullYear(),
          new Date().getMonth() - 1,
          1
        ).getTime() / 1000
      );
      const lastMonthEnd = monthStart;

      // Get course info
      const courseQuery = `
        SELECT id, title, price
        FROM course
        WHERE id = $1
      `;
      const courseResult = await this.query(courseQuery, [courseId]);

      if (!courseResult.success || !courseResult.data[0]) {
        return {
          success: false,
          error: "Course not found",
        };
      }

      const course = courseResult.data[0];

      // Get enrollments (all enrollments, including free ones)
      // Note: takes.timestamp is INTEGER, so compare directly
      const enrollmentsQuery = `
        SELECT 
          COUNT(DISTINCT user_id) as total,
          COUNT(DISTINCT CASE WHEN timestamp >= $1 THEN user_id END) as this_month,
          COUNT(DISTINCT CASE WHEN timestamp >= $2 AND timestamp < $3 THEN user_id END) as last_month
        FROM takes
        WHERE course_id = $4
      `;
      const enrollmentsResult = await this.query(enrollmentsQuery, [
        monthStart,
        lastMonthStart,
        lastMonthEnd,
        courseId,
      ]);

      // Get revenue
      // Note: takes.timestamp is INTEGER, so compare directly
      // Filter out free enrollments (amount IS NULL or transaction_id IS NULL)
      const revenueQuery = `
        SELECT 
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN timestamp >= $1 THEN amount ELSE 0 END), 0) as this_month,
          COALESCE(SUM(CASE WHEN timestamp >= $2 AND timestamp < $3 THEN amount ELSE 0 END), 0) as last_month
        FROM takes
        WHERE amount IS NOT NULL 
          AND transaction_id IS NOT NULL
          AND course_id = $4
      `;
      const revenueResult = await this.query(revenueQuery, [
        monthStart,
        lastMonthStart,
        lastMonthEnd,
        courseId,
      ]);

      // Get completion stats
      const completionQuery = `
        WITH enrolled_users AS (
          SELECT DISTINCT user_id
          FROM takes
          WHERE course_id = $1
        ),
        completed_users AS (
          SELECT DISTINCT p.user_id
          FROM progress p
          JOIN module m ON p.module_id = m.id
          JOIN chapter ch ON m.chapter_id = ch.id
          WHERE ch.course_id = $1
          GROUP BY p.user_id, ch.course_id
          HAVING COUNT(DISTINCT m.id) = (
            SELECT COUNT(DISTINCT m2.id)
            FROM module m2
            JOIN chapter ch2 ON m2.chapter_id = ch2.id
            WHERE ch2.course_id = $1
          )
        ),
        in_progress_users AS (
          SELECT DISTINCT p.user_id
          FROM progress p
          JOIN module m ON p.module_id = m.id
          JOIN chapter ch ON m.chapter_id = ch.id
          WHERE ch.course_id = $1
          AND p.user_id NOT IN (SELECT user_id FROM completed_users)
        )
        SELECT 
          (SELECT COUNT(*) FROM enrolled_users) as total_enrolled,
          (SELECT COUNT(*) FROM completed_users) as completed,
          (SELECT COUNT(*) FROM in_progress_users) as in_progress
      `;
      const completionResult = await this.query(completionQuery, [courseId]);

      // Get engagement stats
      const engagementQuery = `
        SELECT
          (SELECT AVG(current_streak) FROM user_course_streaks WHERE course_id = $1) as average_streak
      `;
      const engagementResult = await this.query(engagementQuery, [courseId]);

      const enrollments =
        enrollmentsResult.success && enrollmentsResult.data[0]
          ? {
              total: parseInt(enrollmentsResult.data[0].total),
              this_month: parseInt(enrollmentsResult.data[0].this_month),
              last_month: parseInt(enrollmentsResult.data[0].last_month),
            }
          : { total: 0, this_month: 0, last_month: 0 };

      const revenue =
        revenueResult.success && revenueResult.data[0]
          ? {
              total: parseFloat(revenueResult.data[0].total),
              this_month: parseFloat(revenueResult.data[0].this_month),
              last_month: parseFloat(revenueResult.data[0].last_month),
            }
          : { total: 0, this_month: 0, last_month: 0 };

      const completion =
        completionResult.success && completionResult.data[0]
          ? {
              total_enrolled: parseInt(
                completionResult.data[0].total_enrolled
              ),
              completed: parseInt(completionResult.data[0].completed),
              in_progress: parseInt(completionResult.data[0].in_progress),
              not_started:
                parseInt(completionResult.data[0].total_enrolled) -
                parseInt(completionResult.data[0].completed) -
                parseInt(completionResult.data[0].in_progress),
            }
          : { total_enrolled: 0, completed: 0, in_progress: 0, not_started: 0 };

      const completionRate =
        completion.total_enrolled > 0
          ? parseFloat(
              ((completion.completed / completion.total_enrolled) * 100).toFixed(
                2
              )
            )
          : 0;

      const engagement =
        engagementResult.success && engagementResult.data[0]
          ? {
              average_streak: parseFloat(
                engagementResult.data[0].average_streak || 0
              ),
            }
          : { average_streak: 0 };

      const growthPercentage = calculateGrowthPercentage(
        enrollments.this_month,
        enrollments.last_month
      );

      return {
        success: true,
        data: {
          course: {
            id: parseInt(course.id),
            title: course.title,
            price: parseFloat(course.price),
          },
          enrollments: {
            ...enrollments,
            growth_percentage: growthPercentage,
          },
          revenue: revenue,
          completion: {
            ...completion,
            completion_rate: completionRate,
          },
          engagement: engagement,
        },
      };
    } catch (error) {
      console.error("Error in getCourseDetailed:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get course completion rates across all courses
   * 
   * Provides completion analytics for courses including:
   * - Total enrolled students per course
   * - Number of completed students
   * - Completion rate percentage
   * 
   * Supports pagination and filtering by specific course.
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.courseId] - Filter by specific course ID
   * @param {number} [filters.limit=20] - Number of results per page (max 100)
   * @param {number} [filters.offset=0] - Pagination offset
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Course completion data
   * @returns {Array} returns.data.courses - Array of course completion objects
   * @returns {number} returns.data.courses[].course_id - Course ID
   * @returns {string} returns.data.courses[].title - Course title
   * @returns {number} returns.data.courses[].total_enrolled - Total enrolled students
   * @returns {number} returns.data.courses[].completed - Number of completed students
   * @returns {number} returns.data.courses[].completion_rate - Completion rate percentage
   * @returns {Object} returns.data.meta - Pagination metadata
   * @returns {string} [returns.error] - Error message if success is false
   */
  getCourseCompletion = async (filters = {}, access = null) => {
    try {
      const { courseId, limit = 20, offset = 0 } = filters;
      const validLimit = validateLimit(limit);
      const validOffset = validateOffset(offset);
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            courses: [],
            meta: {
              total: 0,
              limit: validLimit,
              offset: validOffset,
            },
          },
        };
      }

      let courseFilter = "";
      const params = [];
      if (courseId) {
        courseFilter = "WHERE c.id = $1";
        params.push(courseId);
      } else if (restricted) {
        courseFilter = "WHERE c.id = ANY($1)";
        params.push(courseIds);
      }

      const query = `
        WITH course_enrollments AS (
          SELECT 
            c.id as course_id,
            c.title,
            COUNT(DISTINCT t.user_id) as total_enrolled
          FROM course c
          LEFT JOIN takes t ON c.id = t.course_id
          ${courseFilter}
          GROUP BY c.id, c.title
        ),
        course_completions AS (
          SELECT 
            ch.course_id,
            COUNT(DISTINCT p.user_id) as completed
          FROM progress p
          JOIN module m ON p.module_id = m.id
          JOIN chapter ch ON m.chapter_id = ch.id
          GROUP BY ch.course_id, p.user_id
          HAVING COUNT(DISTINCT m.id) = (
            SELECT COUNT(DISTINCT m2.id)
            FROM module m2
            JOIN chapter ch2 ON m2.chapter_id = ch2.id
            WHERE ch2.course_id = ch.course_id
          )
        )
        SELECT 
          ce.course_id,
          ce.title,
          ce.total_enrolled,
          COALESCE(cc.completed, 0) as completed,
          CASE 
            WHEN ce.total_enrolled > 0 
            THEN ROUND((COALESCE(cc.completed, 0)::numeric / ce.total_enrolled) * 100, 2)
            ELSE 0
          END as completion_rate
        FROM course_enrollments ce
        LEFT JOIN course_completions cc ON ce.course_id = cc.course_id
        ORDER BY completion_rate DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await this.query(query, [
        ...params,
        validLimit,
        validOffset,
      ]);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM course c
        ${courseFilter}
      `;
      const countResult = await this.query(countQuery, params);

      const total =
        countResult.success && countResult.data[0]
          ? parseInt(countResult.data[0].total)
          : 0;

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: {
          courses:
            result.data && result.data.length > 0
              ? result.data.map((c) => ({
                  course_id: parseInt(c.course_id),
                  title: c.title,
                  total_enrolled: parseInt(c.total_enrolled),
                  completed: parseInt(c.completed),
                  completion_rate: parseFloat(c.completion_rate),
                }))
              : [],
          meta: {
            total: total,
            limit: validLimit,
            offset: validOffset,
          },
        },
      };
    } catch (error) {
      console.error("Error in getCourseCompletion:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get comprehensive bundle overview statistics
   * 
   * Provides bundle analytics including:
   * - Total and live bundle counts
   * - Total purchases and revenue
   * - Average revenue per bundle
   * - Top performing bundles
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Bundle overview data
   * @returns {number} returns.data.total_bundles - Total number of bundles
   * @returns {number} returns.data.live_bundles - Number of live and active bundles
   * @returns {number} returns.data.total_purchases - Total bundle purchases
   * @returns {number} returns.data.total_revenue - Total revenue from bundles
   * @returns {number} returns.data.average_revenue_per_bundle - Average revenue per bundle
   * @returns {Array} returns.data.top_bundles - Top 10 bundles by revenue
   * @returns {string} [returns.error] - Error message if success is false
   */
  getBundleOverview = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate } = filters;
      const dateRange = parseDateRange(startDate, endDate);
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            total_bundles: 0,
            live_bundles: 0,
            total_purchases: 0,
            total_revenue: 0,
            average_revenue_per_bundle: 0,
            top_bundles: [],
          },
        };
      }

      // Note: bundle_purchase.timestamp is INTEGER, so compare directly
      const bundleStatsQuery = `
        SELECT 
          COUNT(DISTINCT b.id) as total_bundles,
          COUNT(DISTINCT CASE WHEN b.is_live = true AND b.is_active = true THEN b.id END) as live_bundles,
          COUNT(DISTINCT bp.user_id) as total_purchases,
          COALESCE(SUM(bp.amount), 0) as total_revenue,
          CASE 
            WHEN COUNT(DISTINCT b.id) > 0 
            THEN ROUND(COALESCE(SUM(bp.amount), 0)::numeric / COUNT(DISTINCT b.id), 2)
            ELSE 0
          END as average_revenue_per_bundle
        FROM bundle b
        LEFT JOIN bundle_purchase bp ON b.id = bp.bundle_id
          AND ($1::bigint IS NULL OR bp.timestamp >= $1)
          AND ($2::bigint IS NULL OR bp.timestamp <= $2)
        ${
          restricted
            ? "WHERE EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = b.id AND bc.course_id = ANY($3))"
            : ""
        }
      `;
      const bundleStatsResult = await this.query(bundleStatsQuery, [
        dateRange.start,
        dateRange.end,
        ...(restricted ? [courseIds] : []),
      ]);

      // Get top bundles
      // Note: bundle_purchase.timestamp is INTEGER, so compare directly
      const topBundlesQuery = `
        SELECT 
          b.id as bundle_id,
          b.title,
          COUNT(DISTINCT bp.user_id) as purchases,
          COALESCE(SUM(bp.amount), 0) as revenue
        FROM bundle b
        LEFT JOIN bundle_purchase bp ON b.id = bp.bundle_id
          AND ($1::bigint IS NULL OR bp.timestamp >= $1)
          AND ($2::bigint IS NULL OR bp.timestamp <= $2)
        WHERE b.is_live = true AND b.is_active = true
          ${
            restricted
              ? "AND EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = b.id AND bc.course_id = ANY($3))"
              : ""
          }
        GROUP BY b.id, b.title
        ORDER BY revenue DESC
        LIMIT 10
      `;
      const topBundlesResult = await this.query(topBundlesQuery, [
        dateRange.start,
        dateRange.end,
        ...(restricted ? [courseIds] : []),
      ]);

      const stats =
        bundleStatsResult.success && bundleStatsResult.data[0]
          ? {
              total_bundles: parseInt(bundleStatsResult.data[0].total_bundles),
              live_bundles: parseInt(bundleStatsResult.data[0].live_bundles),
              total_purchases: parseInt(
                bundleStatsResult.data[0].total_purchases
              ),
              total_revenue: parseFloat(bundleStatsResult.data[0].total_revenue),
              average_revenue_per_bundle: parseFloat(
                bundleStatsResult.data[0].average_revenue_per_bundle
              ),
            }
          : {
              total_bundles: 0,
              live_bundles: 0,
              total_purchases: 0,
              total_revenue: 0,
              average_revenue_per_bundle: 0,
            };

      return {
        success: true,
        data: {
          ...stats,
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
      };
    } catch (error) {
      console.error("Error in getBundleOverview:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get detailed analytics for a specific bundle
   * 
   * Provides comprehensive analytics for a single bundle including:
   * - Bundle information (id, title, price)
   * - Purchase trends (total, this month, last month, growth)
   * - Revenue breakdown (total, this month, last month)
   * 
   * @param {number} bundleId - Bundle ID - REQUIRED
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Bundle detailed data
   * @returns {Object} returns.data.bundle - Bundle information
   * @returns {number} returns.data.bundle.id - Bundle ID
   * @returns {string} returns.data.bundle.title - Bundle title
   * @returns {number} returns.data.bundle.price - Bundle price
   * @returns {Object} returns.data.purchases - Purchase statistics
   * @returns {Object} returns.data.revenue - Revenue statistics
   * @returns {string} [returns.error] - Error message if success is false
   * 
   * @throws {Object} Returns error object if bundle is not found
   */
  getBundleDetailed = async (bundleId, filters = {}, access = null) => {
    try {
      const { startDate, endDate } = filters;
      const dateRange = parseDateRange(startDate, endDate);
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);
      const monthStart = Math.floor(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() /
          1000
      );
      const lastMonthStart = Math.floor(
        new Date(
          new Date().getFullYear(),
          new Date().getMonth() - 1,
          1
        ).getTime() / 1000
      );
      const lastMonthEnd = monthStart;

      // Get bundle info
      const bundleQuery = `
        SELECT id, title, price
        FROM bundle
        WHERE id = $1
          ${
            restricted
              ? "AND EXISTS (SELECT 1 FROM bundle_course bc WHERE bc.bundle_id = bundle.id AND bc.course_id = ANY($2))"
              : ""
          }
      `;
      const bundleResult = await this.query(
        bundleQuery,
        restricted ? [bundleId, courseIds] : [bundleId]
      );

      if (!bundleResult.success || !bundleResult.data[0]) {
        return {
          success: false,
          error: "Bundle not found",
        };
      }

      const bundle = bundleResult.data[0];

      // Get purchases
      // Note: bundle_purchase.timestamp is INTEGER, so compare directly
      const purchasesQuery = `
        SELECT 
          COUNT(DISTINCT user_id) as total,
          COUNT(DISTINCT CASE WHEN timestamp >= $1 THEN user_id END) as this_month,
          COUNT(DISTINCT CASE WHEN timestamp >= $2 AND timestamp < $3 THEN user_id END) as last_month
        FROM bundle_purchase
        WHERE bundle_id = $4
      `;
      const purchasesResult = await this.query(purchasesQuery, [
        monthStart,
        lastMonthStart,
        lastMonthEnd,
        bundleId,
      ]);

      // Get revenue
      // Note: bundle_purchase.timestamp is INTEGER, so compare directly
      const revenueQuery = `
        SELECT 
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN timestamp >= $1 THEN amount ELSE 0 END), 0) as this_month,
          COALESCE(SUM(CASE WHEN timestamp >= $2 AND timestamp < $3 THEN amount ELSE 0 END), 0) as last_month
        FROM bundle_purchase
        WHERE bundle_id = $4
      `;
      const revenueResult = await this.query(revenueQuery, [
        monthStart,
        lastMonthStart,
        lastMonthEnd,
        bundleId,
      ]);

      const purchases =
        purchasesResult.success && purchasesResult.data[0]
          ? {
              total: parseInt(purchasesResult.data[0].total),
              this_month: parseInt(purchasesResult.data[0].this_month),
              last_month: parseInt(purchasesResult.data[0].last_month),
            }
          : { total: 0, this_month: 0, last_month: 0 };

      const revenue =
        revenueResult.success && revenueResult.data[0]
          ? {
              total: parseFloat(revenueResult.data[0].total),
              this_month: parseFloat(revenueResult.data[0].this_month),
              last_month: parseFloat(revenueResult.data[0].last_month),
            }
          : { total: 0, this_month: 0, last_month: 0 };

      const growthPercentage = calculateGrowthPercentage(
        purchases.this_month,
        purchases.last_month
      );

      return {
        success: true,
        data: {
          bundle: {
            id: parseInt(bundle.id),
            title: bundle.title,
            price: parseFloat(bundle.price),
          },
          purchases: {
            ...purchases,
            growth_percentage: growthPercentage,
          },
          revenue: revenue,
        },
      };
    } catch (error) {
      console.error("Error in getBundleDetailed:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get learning progress overview and statistics
   * 
   * Provides learning analytics including:
   * - Total modules completed
   * - Active learners (30 days)
   * - Total progress records
   * - Average completion rate
   * - Top learners leaderboard
   * 
   * Can be filtered by specific course.
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * @param {number} [filters.courseId] - Filter by specific course ID
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Learning progress data
   * @returns {number} returns.data.total_modules_completed - Total modules completed
   * @returns {number} returns.data.active_learners_30d - Active learners in last 30 days
   * @returns {number} returns.data.total_progress_records - Total progress records
   * @returns {number} returns.data.average_completion_rate - Average course completion rate
   * @returns {Array} returns.data.top_learners - Top 10 learners by modules completed
   * @returns {string} [returns.error] - Error message if success is false
   */
  getLearningProgress = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate, courseId } = filters;
      const dateRange = parseDateRange(startDate, endDate);
      const now = Math.floor(Date.now() / 1000);
      const day = 86400;
      const last30Days = now - 30 * day;
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            total_modules_completed: 0,
            total_progress_records: 0,
            average_completion_rate: 0,
            active_learners_30d: 0,
            top_learners: [],
          },
        };
      }

      // Get progress statistics
      // Note: progress.timestamp is INTEGER, so compare directly
      let progressParams = [last30Days];
      let progressWhereClause = "WHERE p.timestamp >= $1";
      let paramIndex = 2;

      if (dateRange.start) {
        progressWhereClause += ` AND p.timestamp >= $${paramIndex}`;
        progressParams.push(dateRange.start);
        paramIndex++;
      }
      if (dateRange.end) {
        progressWhereClause += ` AND p.timestamp <= $${paramIndex}`;
        progressParams.push(dateRange.end);
        paramIndex++;
      }
      if (courseId) {
        progressWhereClause += ` AND ch.course_id = $${paramIndex}`;
        progressParams.push(courseId);
        paramIndex++;
      } else if (restricted) {
        progressWhereClause += ` AND ch.course_id = ANY($${paramIndex})`;
        progressParams.push(courseIds);
        paramIndex++;
      }

      const progressQuery = `
        SELECT 
          COUNT(*) as total_modules_completed,
          COUNT(DISTINCT p.user_id) as active_learners_30d
        FROM progress p
        JOIN module m ON p.module_id = m.id
        JOIN chapter ch ON m.chapter_id = ch.id
        ${progressWhereClause}
      `;
      
      const progressResult = await this.query(progressQuery, progressParams);

      // Get total progress records
      // Note: progress.timestamp is INTEGER, so compare directly
      // Ensure null values are properly handled
      const totalProgressQuery = `
        SELECT COUNT(*) as total
        FROM progress p
        JOIN module m ON p.module_id = m.id
        JOIN chapter ch ON m.chapter_id = ch.id
        WHERE ($1::bigint IS NULL OR p.timestamp >= $1::bigint)
          AND ($2::bigint IS NULL OR p.timestamp <= $2::bigint)
          ${courseId ? "AND ch.course_id = $3" : restricted ? "AND ch.course_id = ANY($3)" : ""}
      `;
      const totalProgressResult = await this.query(totalProgressQuery, [
        dateRange.start || null,
        dateRange.end || null,
        ...(courseId ? [courseId] : restricted ? [courseIds] : []),
      ]);

      // Get average completion rate
      const avgCompletionQuery = `
        SELECT 
          AVG(completion_rate) as avg_completion_rate
        FROM (
          SELECT 
            ch.course_id,
            COUNT(DISTINCT t.user_id) as enrolled,
            COUNT(DISTINCT p.user_id) as completed,
            CASE 
              WHEN COUNT(DISTINCT t.user_id) > 0 
              THEN (COUNT(DISTINCT p.user_id)::numeric / COUNT(DISTINCT t.user_id)) * 100
              ELSE 0
            END as completion_rate
          FROM course c
          LEFT JOIN takes t ON c.id = t.course_id
          LEFT JOIN chapter ch ON c.id = ch.course_id
          LEFT JOIN module m ON ch.id = m.chapter_id
          LEFT JOIN progress p ON m.id = p.module_id AND p.user_id = t.user_id
          ${
            courseId
              ? "WHERE c.id = $1"
              : restricted
              ? "WHERE c.id = ANY($1)"
              : ""
          }
          GROUP BY ch.course_id
        ) as course_completion
      `;
      const avgCompletionResult = await this.query(avgCompletionQuery, [
        ...(courseId ? [courseId] : restricted ? [courseIds] : []),
      ]);

      // Get top learners
      // Note: progress.timestamp is INTEGER, so compare directly
      let topLearnersParams = [];
      let topLearnersWhereClause = [];
      let topLearnersParamIndex = 1;

      if (dateRange.start) {
        topLearnersWhereClause.push(`p.timestamp >= $${topLearnersParamIndex}`);
        topLearnersParams.push(dateRange.start);
        topLearnersParamIndex++;
      }
      if (dateRange.end) {
        topLearnersWhereClause.push(`p.timestamp <= $${topLearnersParamIndex}`);
        topLearnersParams.push(dateRange.end);
        topLearnersParamIndex++;
      }
      if (courseId) {
        topLearnersWhereClause.push(`ch.course_id = $${topLearnersParamIndex}`);
        topLearnersParams.push(courseId);
        topLearnersParamIndex++;
      } else if (restricted) {
        topLearnersWhereClause.push(`ch.course_id = ANY($${topLearnersParamIndex})`);
        topLearnersParams.push(courseIds);
        topLearnersParamIndex++;
      }

      const topLearnersWhere = topLearnersWhereClause.length > 0 
        ? `WHERE ${topLearnersWhereClause.join(" AND ")}`
        : "";

      const topLearnersQuery = `
        SELECT 
          u.id as user_id,
          u.name,
          COUNT(DISTINCT p.module_id) as modules_completed,
          MAX(ucs.current_streak) as current_streak
        FROM progress p
        JOIN managerial_auth u ON p.user_id = u.id
        LEFT JOIN user_course_streaks ucs ON u.id = ucs.user_id
          ${courseId ? `AND ucs.course_id = $${topLearnersParamIndex}` : restricted ? `AND ucs.course_id = ANY($${topLearnersParamIndex})` : ""}
        JOIN module m ON p.module_id = m.id
        JOIN chapter ch ON m.chapter_id = ch.id
        ${topLearnersWhere}
        GROUP BY u.id, u.name
        ORDER BY modules_completed DESC
        LIMIT 10
      `;
      
      if (courseId) {
        topLearnersParams.push(courseId);
      } else if (restricted) {
        topLearnersParams.push(courseIds);
      }
      
      const topLearnersResult = await this.query(topLearnersQuery, topLearnersParams);

      const progress =
        progressResult.success && progressResult.data[0]
          ? {
              total_modules_completed: parseInt(
                progressResult.data[0].total_modules_completed
              ),
              active_learners_30d: parseInt(
                progressResult.data[0].active_learners_30d
              ),
            }
          : { total_modules_completed: 0, active_learners_30d: 0 };

      const totalProgress =
        totalProgressResult.success && totalProgressResult.data[0]
          ? parseInt(totalProgressResult.data[0].total)
          : 0;

      const avgCompletionRate =
        avgCompletionResult.success && avgCompletionResult.data[0]
          ? parseFloat(avgCompletionResult.data[0].avg_completion_rate || 0)
          : 0;

      return {
        success: true,
        data: {
          total_modules_completed: progress.total_modules_completed,
          total_progress_records: totalProgress,
          average_completion_rate: parseFloat(avgCompletionRate.toFixed(2)),
          active_learners_30d: progress.active_learners_30d,
          top_learners:
            topLearnersResult.success && topLearnersResult.data
              ? topLearnersResult.data.map((l) => ({
                  user_id: parseInt(l.user_id),
                  name: l.name,
                  modules_completed: parseInt(l.modules_completed),
                  current_streak: parseInt(l.current_streak || 0),
                }))
              : [],
        },
      };
    } catch (error) {
      console.error("Error in getLearningProgress:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get learning streak analytics and leaderboards
   * 
   * Provides streak analytics including:
   * - Individual user streaks (current and longest)
   * - Summary statistics (average streaks, total active streaks)
   * 
   * Supports pagination and filtering by specific course.
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.courseId] - Filter by specific course ID
   * @param {number} [filters.limit=20] - Number of results per page (max 100)
   * @param {number} [filters.offset=0] - Pagination offset
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Streak analytics data
   * @returns {Array} returns.data.streaks - Array of streak objects
   * @returns {number} returns.data.streaks[].user_id - User ID
   * @returns {number} returns.data.streaks[].course_id - Course ID
   * @returns {number} returns.data.streaks[].current_streak - Current streak days
   * @returns {number} returns.data.streaks[].longest_streak - Longest streak days
   * @returns {string} returns.data.streaks[].last_activity_date - Last activity date
   * @returns {Object} returns.data.summary - Summary statistics
   * @returns {number} returns.data.summary.average_current_streak - Average current streak
   * @returns {number} returns.data.summary.average_longest_streak - Average longest streak
   * @returns {number} returns.data.summary.total_active_streaks - Total active streaks
   * @returns {string} [returns.error] - Error message if success is false
   */
  getStreakAnalytics = async (filters = {}, access = null) => {
    try {
      const { courseId, limit = 20, offset = 0 } = filters;
      const validLimit = validateLimit(limit);
      const validOffset = validateOffset(offset);
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            streaks: [],
            summary: {
              average_current_streak: 0,
              average_longest_streak: 0,
              total_active_streaks: 0,
            },
          },
        };
      }

      let courseFilter = "";
      const params = [];
      if (courseId) {
        courseFilter = "WHERE course_id = $1";
        params.push(courseId);
      } else if (restricted) {
        courseFilter = "WHERE course_id = ANY($1)";
        params.push(courseIds);
      }

      const query = `
        SELECT 
          ucs.user_id,
          ucs.course_id,
          ucs.current_streak,
          ucs.longest_streak,
          ucs.last_activity_date
        FROM user_course_streaks ucs
        ${courseFilter}
        ORDER BY ucs.current_streak DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await this.query(query, [
        ...params,
        validLimit,
        validOffset,
      ]);

      // Get summary stats
      const summaryQuery = `
        SELECT 
          AVG(current_streak) as avg_current_streak,
          AVG(longest_streak) as avg_longest_streak,
          COUNT(*) as total_active_streaks
        FROM user_course_streaks
        ${courseFilter}
      `;
      const summaryResult = await this.query(summaryQuery, params);

      const total =
        summaryResult.success && summaryResult.data[0]
          ? parseInt(summaryResult.data[0].total_active_streaks)
          : 0;

      if (!result.success) {
        return result;
      }

      const summary =
        summaryResult.success && summaryResult.data[0]
          ? {
              average_current_streak: parseFloat(
                summaryResult.data[0].avg_current_streak || 0
              ),
              average_longest_streak: parseFloat(
                summaryResult.data[0].avg_longest_streak || 0
              ),
              total_active_streaks: total,
            }
          : {
              average_current_streak: 0,
              average_longest_streak: 0,
              total_active_streaks: 0,
            };

      return {
        success: true,
        data: {
          streaks:
            result.data && result.data.length > 0
              ? result.data.map((s) => ({
                  user_id: parseInt(s.user_id),
                  course_id: parseInt(s.course_id),
                  current_streak: parseInt(s.current_streak),
                  longest_streak: parseInt(s.longest_streak),
                  last_activity_date: s.last_activity_date,
                }))
              : [],
          summary: summary,
        },
      };
    } catch (error) {
      console.error("Error in getStreakAnalytics:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get comprehensive coupon overview statistics
   * 
   * Provides coupon analytics including:
   * - Total and active coupon counts
   * - Total usage and discount given
   * - Revenue generated with coupons
   * - Conversion rate (coupon usage vs total transactions)
   * - Top performing coupons
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Coupon overview data
   * @returns {number} returns.data.total_coupons - Total number of coupons
   * @returns {number} returns.data.active_coupons - Number of active coupons
   * @returns {number} returns.data.total_usage - Total coupon usage count
   * @returns {number} returns.data.total_discount_given - Total discount amount given
   * @returns {number} returns.data.total_revenue_with_coupons - Revenue from coupon transactions
   * @returns {number} returns.data.conversion_rate - Coupon usage rate percentage
   * @returns {Array} returns.data.top_coupons - Top 10 coupons by usage
   * @returns {string} [returns.error] - Error message if success is false
   */
  getCouponOverview = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate } = filters;
      const dateRange = parseDateRange(startDate, endDate);

      // Get coupon statistics
      const couponStatsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE status != 'deleted') as total_coupons,
          COUNT(*) FILTER (WHERE status = 'active') as active_coupons,
          COALESCE(SUM(usage_count), 0) as total_usage
        FROM coupons
        WHERE status != 'deleted'
      `;
      const couponStatsResult = await this.query(couponStatsQuery, []);

      // Get coupon usage statistics
      const usageQuery = `
        SELECT 
          COUNT(*) as total_usage,
          COALESCE(SUM(discount_amount), 0) as total_discount_given,
          COALESCE(SUM(final_price), 0) as total_revenue_with_coupons
        FROM coupon_usage
        WHERE payment_status = 'completed'
          AND ($1::bigint IS NULL OR used_at >= $1)
          AND ($2::bigint IS NULL OR used_at <= $2)
      `;
      const usageResult = await this.query(usageQuery, [
        dateRange.start,
        dateRange.end,
      ]);

      // Get conversion rate (coupon usage vs total transactions)
      // Note: takes.timestamp is INTEGER, coupon_usage.used_at is INTEGER, so compare directly
      const conversionQuery = `
        SELECT 
          (SELECT COUNT(*) FROM coupon_usage WHERE payment_status = 'completed' 
           AND ($1::bigint IS NULL OR used_at >= $1) AND ($2::bigint IS NULL OR used_at <= $2)) as coupon_transactions,
          (SELECT COUNT(*) FROM takes 
           WHERE amount IS NOT NULL 
             AND transaction_id IS NOT NULL
             AND ($1::bigint IS NULL OR timestamp >= $1) 
             AND ($2::bigint IS NULL OR timestamp <= $2)) as total_transactions
      `;
      const conversionResult = await this.query(conversionQuery, [
        dateRange.start,
        dateRange.end,
      ]);

      // Get top coupons
      const topCouponsQuery = `
        SELECT 
          c.id as coupon_id,
          c.code,
          c.usage_count,
          COALESCE(SUM(cu.discount_amount), 0) as discount_given,
          COALESCE(SUM(cu.final_price), 0) as revenue_generated
        FROM coupons c
        LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
          AND cu.payment_status = 'completed'
          AND ($1::bigint IS NULL OR cu.used_at >= $1)
          AND ($2::bigint IS NULL OR cu.used_at <= $2)
        WHERE c.status != 'deleted'
        GROUP BY c.id, c.code, c.usage_count
        ORDER BY usage_count DESC
        LIMIT 10
      `;
      const topCouponsResult = await this.query(topCouponsQuery, [
        dateRange.start,
        dateRange.end,
      ]);

      const stats =
        couponStatsResult.success && couponStatsResult.data[0]
          ? {
              total_coupons: parseInt(
                couponStatsResult.data[0].total_coupons
              ),
              active_coupons: parseInt(
                couponStatsResult.data[0].active_coupons
              ),
              total_usage: parseInt(couponStatsResult.data[0].total_usage),
            }
          : { total_coupons: 0, active_coupons: 0, total_usage: 0 };

      const usage =
        usageResult.success && usageResult.data[0]
          ? {
              total_usage: parseInt(usageResult.data[0].total_usage),
              total_discount_given: parseFloat(
                usageResult.data[0].total_discount_given
              ),
              total_revenue_with_coupons: parseFloat(
                usageResult.data[0].total_revenue_with_coupons
              ),
            }
          : {
              total_usage: 0,
              total_discount_given: 0,
              total_revenue_with_coupons: 0,
            };

      const conversion =
        conversionResult.success && conversionResult.data[0]
          ? {
              coupon_transactions: parseInt(
                conversionResult.data[0].coupon_transactions
              ),
              total_transactions: parseInt(
                conversionResult.data[0].total_transactions
              ),
            }
          : { coupon_transactions: 0, total_transactions: 0 };

      const conversionRate =
        conversion.total_transactions > 0
          ? parseFloat(
              (
                (conversion.coupon_transactions /
                  conversion.total_transactions) *
                100
              ).toFixed(2)
            )
          : 0;

      return {
        success: true,
        data: {
          total_coupons: stats.total_coupons,
          active_coupons: stats.active_coupons,
          total_usage: usage.total_usage,
          total_discount_given: usage.total_discount_given,
          total_revenue_with_coupons: usage.total_revenue_with_coupons,
          conversion_rate: conversionRate,
          top_coupons:
            topCouponsResult.success && topCouponsResult.data
              ? topCouponsResult.data.map((c) => ({
                  coupon_id: parseInt(c.coupon_id),
                  code: c.code,
                  usage_count: parseInt(c.usage_count),
                  discount_given: parseFloat(c.discount_given),
                  revenue_generated: parseFloat(c.revenue_generated),
                }))
              : [],
        },
      };
    } catch (error) {
      console.error("Error in getCouponOverview:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get detailed coupon performance metrics
   * 
   * Provides performance analytics for individual coupons including:
   * - Usage count
   * - Discount given
   * - Revenue generated
   * - Average discount per use
   * 
   * Supports pagination and filtering by specific coupon.
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.couponId] - Filter by specific coupon ID
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * @param {number} [filters.limit=20] - Number of results per page (max 100)
   * @param {number} [filters.offset=0] - Pagination offset
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Coupon performance data
   * @returns {Array} returns.data.coupons - Array of coupon performance objects
   * @returns {number} returns.data.coupons[].coupon_id - Coupon ID
   * @returns {string} returns.data.coupons[].code - Coupon code
   * @returns {number} returns.data.coupons[].usage_count - Number of times used
   * @returns {number} returns.data.coupons[].discount_given - Total discount amount
   * @returns {number} returns.data.coupons[].revenue_generated - Revenue from coupon transactions
   * @returns {number} returns.data.coupons[].average_discount - Average discount per use
   * @returns {Object} returns.data.meta - Pagination metadata
   * @returns {string} [returns.error] - Error message if success is false
   */
  getCouponPerformance = async (filters = {}, access = null) => {
    try {
      const {
        couponId,
        startDate,
        endDate,
        limit = 20,
        offset = 0,
      } = filters;
      const dateRange = parseDateRange(startDate, endDate);
      const validLimit = validateLimit(limit);
      const validOffset = validateOffset(offset);

      let couponFilter = "";
      const params = [];
      if (couponId) {
        couponFilter = "WHERE c.id = $1";
        params.push(couponId);
      } else {
        couponFilter = "WHERE c.status != 'deleted'";
      }

      const query = `
        SELECT 
          c.id as coupon_id,
          c.code,
          c.usage_count,
          COALESCE(SUM(cu.discount_amount), 0) as discount_given,
          COALESCE(SUM(cu.final_price), 0) as revenue_generated,
          CASE 
            WHEN c.usage_count > 0 
            THEN ROUND(COALESCE(SUM(cu.discount_amount), 0)::numeric / c.usage_count, 2)
            ELSE 0
          END as average_discount
        FROM coupons c
        LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
          AND cu.payment_status = 'completed'
          AND ($${params.length + 1}::bigint IS NULL OR cu.used_at >= $${params.length + 1})
          AND ($${params.length + 2}::bigint IS NULL OR cu.used_at <= $${params.length + 2})
        ${couponFilter}
        GROUP BY c.id, c.code, c.usage_count
        ORDER BY usage_count DESC
        LIMIT $${params.length + 3} OFFSET $${params.length + 4}
      `;

      const result = await this.query(query, [
        ...params,
        dateRange.start,
        dateRange.end,
        validLimit,
        validOffset,
      ]);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM coupons c
        ${couponFilter}
      `;
      const countResult = await this.query(countQuery, params);

      const total =
        countResult.success && countResult.data[0]
          ? parseInt(countResult.data[0].total)
          : 0;

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: {
          coupons:
            result.data && result.data.length > 0
              ? result.data.map((c) => ({
                  coupon_id: parseInt(c.coupon_id),
                  code: c.code,
                  usage_count: parseInt(c.usage_count),
                  discount_given: parseFloat(c.discount_given),
                  revenue_generated: parseFloat(c.revenue_generated),
                  average_discount: parseFloat(c.average_discount),
                  usage_trend: "increasing", // Could be calculated based on historical data
                }))
              : [],
          meta: {
            total: total,
            limit: validLimit,
            offset: validOffset,
          },
        },
      };
    } catch (error) {
      console.error("Error in getCouponPerformance:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };

  /**
   * Get payment statistics and transaction success rates
   * 
   * Provides payment analytics including:
   * - Total, successful, and failed payment counts
   * - Success rate percentage
   * - Total amount processed
   * - Average transaction value
   * - Payment trends over time
   * 
   * @param {Object} filters - Filter options
   * @param {number} [filters.startDate] - Start date as Unix timestamp (seconds)
   * @param {number} [filters.endDate] - End date as Unix timestamp (seconds)
   * 
   * @returns {Promise<Object>} Response object
   * @returns {boolean} returns.success - Whether the operation was successful
   * @returns {Object} returns.data - Payment overview data
   * @returns {number} returns.data.total_payments - Total payment attempts
   * @returns {number} returns.data.successful_payments - Successful payments
   * @returns {number} returns.data.failed_payments - Failed payments
   * @returns {number} returns.data.success_rate - Payment success rate percentage
   * @returns {number} returns.data.total_amount - Total amount from successful payments
   * @returns {number} returns.data.average_transaction_value - Average transaction value
   * @returns {Array} returns.data.trends - Payment trends by month
   * @returns {string} [returns.error] - Error message if success is false
   */
  getPaymentOverview = async (filters = {}, access = null) => {
    try {
      const { startDate, endDate } = filters;
      const dateRange = parseDateRange(startDate, endDate);
      const restricted = this._isRestrictedAccess(access);
      const courseIds = this._getAccessibleCourseIds(access);

      if (this._hasNoAccessibleCourses(access)) {
        return {
          success: true,
          data: {
            total_payments: 0,
            successful_payments: 0,
            failed_payments: 0,
            success_rate: 0,
            total_amount: 0,
            average_transaction_value: 0,
            payment_trends: [],
          },
        };
      }

      // Get payment statistics from payment_audit_log
      // Note: payment_audit_log.timestamp is INTEGER, so compare directly
      const paymentQuery = `
        SELECT 
          COUNT(*) as total_payments,
          COUNT(*) FILTER (WHERE status = 'VALID' AND processing_status = 'SUCCESS') as successful_payments,
          COUNT(*) FILTER (WHERE status = 'FAILED' OR processing_status = 'FAILED') as failed_payments,
          COALESCE(SUM(CASE WHEN status = 'VALID' AND processing_status = 'SUCCESS' THEN amount ELSE 0 END), 0) as total_amount
        FROM payment_audit_log
        WHERE ($1::bigint IS NULL OR timestamp >= $1)
          AND ($2::bigint IS NULL OR timestamp <= $2)
          ${
            restricted
              ? `AND (
            (item_type = 'COURSE' AND item_id = ANY($3))
            OR
            (item_type = 'BUNDLE' AND EXISTS (
              SELECT 1
              FROM bundle_course bc
              WHERE bc.bundle_id = payment_audit_log.item_id
                AND bc.course_id = ANY($3)
            ))
          )`
              : ""
          }
      `;
      const paymentResult = await this.query(paymentQuery, [
        dateRange.start,
        dateRange.end,
        ...(restricted ? [courseIds] : []),
      ]);

      // Get payment trends by month
      // Note: payment_audit_log.timestamp is INTEGER, convert to timestamp for DATE_TRUNC
      const trendsQuery = `
        SELECT 
          DATE_TRUNC('month', to_timestamp(timestamp)) as period,
          COUNT(*) FILTER (WHERE status = 'VALID' AND processing_status = 'SUCCESS') as successful,
          COUNT(*) FILTER (WHERE status = 'FAILED' OR processing_status = 'FAILED') as failed
        FROM payment_audit_log
        WHERE ($1::bigint IS NULL OR timestamp >= $1)
          AND ($2::bigint IS NULL OR timestamp <= $2)
          ${
            restricted
              ? `AND (
            (item_type = 'COURSE' AND item_id = ANY($3))
            OR
            (item_type = 'BUNDLE' AND EXISTS (
              SELECT 1
              FROM bundle_course bc
              WHERE bc.bundle_id = payment_audit_log.item_id
                AND bc.course_id = ANY($3)
            ))
          )`
              : ""
          }
        GROUP BY period
        ORDER BY period ASC
      `;
      const trendsResult = await this.query(trendsQuery, [
        dateRange.start,
        dateRange.end,
        ...(restricted ? [courseIds] : []),
      ]);

      const stats =
        paymentResult.success && paymentResult.data[0]
          ? {
              total_payments: parseInt(
                paymentResult.data[0].total_payments
              ),
              successful_payments: parseInt(
                paymentResult.data[0].successful_payments
              ),
              failed_payments: parseInt(
                paymentResult.data[0].failed_payments
              ),
              total_amount: parseFloat(paymentResult.data[0].total_amount),
            }
          : {
              total_payments: 0,
              successful_payments: 0,
              failed_payments: 0,
              total_amount: 0,
            };

      const successRate =
        stats.total_payments > 0
          ? parseFloat(
              ((stats.successful_payments / stats.total_payments) * 100).toFixed(
                2
              )
            )
          : 0;

      const averageTransactionValue =
        stats.successful_payments > 0
          ? parseFloat((stats.total_amount / stats.successful_payments).toFixed(2))
          : 0;

      const trends =
        trendsResult.success && trendsResult.data
          ? trendsResult.data.map((t) => ({
              period: t.period
                ? new Date(t.period).toISOString().split("T")[0]
                : null,
              successful: parseInt(t.successful),
              failed: parseInt(t.failed),
              success_rate:
                parseInt(t.successful) + parseInt(t.failed) > 0
                  ? parseFloat(
                      (
                        (parseInt(t.successful) /
                          (parseInt(t.successful) + parseInt(t.failed))) *
                        100
                      ).toFixed(2)
                    )
                  : 0,
            }))
          : [];

      return {
        success: true,
        data: {
          total_payments: stats.total_payments,
          successful_payments: stats.successful_payments,
          failed_payments: stats.failed_payments,
          success_rate: successRate,
          total_amount: stats.total_amount,
          average_transaction_value: averageTransactionValue,
          payment_trends: trends,
        },
      };
    } catch (error) {
      console.error("Error in getPaymentOverview:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };
}

module.exports = { AnalyticsV2Service };
