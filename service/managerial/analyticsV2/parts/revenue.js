// Revenue: summary, trends, per course / bundle, predictions.
// Part of AnalyticsV2Service (../analyticsV2Service.js), which callers use.
const { AnalyticsV2Base } = require("./base");
const { parseDateRange } = require("../../../../util/analyticsV2/dateUtils");
const { buildOrderBy, validateLimit, validateOffset, buildDateGrouping } = require("../../../../util/analyticsV2/queryUtils");
const logger = require('../../../../util/logger');

class RevenueAnalyticsService extends AnalyticsV2Base {
  constructor() {
    super();
  }

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
      logger.error("Error in getRevenuePredictions:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };
}

module.exports = { RevenueAnalyticsService };
