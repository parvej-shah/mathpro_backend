// Students: overview, growth, engagement, learning progress and streaks.
// Part of AnalyticsV2Service (../analyticsV2Service.js), which callers use.
const { AnalyticsV2Base } = require("./base");
const { parseDateRange } = require("../../../../util/analyticsV2/dateUtils");
const { validateLimit, validateOffset, buildDateGrouping } = require("../../../../util/analyticsV2/queryUtils");
const logger = require('../../../../util/logger');
const { dateRangeFilter } = require('../../../../util/dateRangeFilter');

class UserAnalyticsService extends AnalyticsV2Base {
  constructor() {
    super();
  }

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
      logger.error("Error in getUserOverview:", error);
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
      logger.error("Error in getUserGrowth:", error);
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
      logger.error("Error in getUserEngagement:", error);
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

      const progressDates = dateRangeFilter('p.timestamp', dateRange.start, dateRange.end, { startIndex: paramIndex });
      progressWhereClause += progressDates.conditions.map((condition) => ` AND ${condition}`).join('');
      progressParams.push(...progressDates.params);
      paramIndex = progressDates.nextIndex;
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

      const dateFilter = dateRangeFilter('p.timestamp', dateRange.start, dateRange.end, { startIndex: topLearnersParamIndex });
      topLearnersWhereClause.push(...dateFilter.conditions);
      topLearnersParams.push(...dateFilter.params);
      topLearnersParamIndex = dateFilter.nextIndex;
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
      logger.error("Error in getLearningProgress:", error);
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
      logger.error("Error in getStreakAnalytics:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };
}

module.exports = { UserAnalyticsService };
