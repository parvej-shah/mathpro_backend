// Courses and bundles: overview, detail and completion.
// Part of AnalyticsV2Service (../analyticsV2Service.js), which callers use.
const { AnalyticsV2Base } = require("./base");
const { parseDateRange, calculateGrowthPercentage } = require("../../../../util/analyticsV2/dateUtils");
const { validateLimit, validateOffset } = require("../../../../util/analyticsV2/queryUtils");
const logger = require('../../../../util/logger');

class CatalogAnalyticsService extends AnalyticsV2Base {
  constructor() {
    super();
  }

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
      logger.error("Error in getCourseOverview:", error);
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
      logger.error("Error in getCourseDetailed:", error);
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
      logger.error("Error in getCourseCompletion:", error);
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
      logger.error("Error in getBundleOverview:", error);
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
      logger.error("Error in getBundleDetailed:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };
}

module.exports = { CatalogAnalyticsService };
