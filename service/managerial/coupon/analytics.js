// Coupon usage, revenue and performance reports (read-only).
// Part of CouponService (service/managerial/coupon.js), which callers use.
const { Service } = require("../../base");
const logger = require('../../../util/logger');

class CouponAnalyticsService extends Service {
  constructor() {
    super();
  }

  /**
   * Get overall coupon click and conversion statistics
   * @param {Object} dateRange - Optional date range (dateFrom, dateTo)
   * @returns {Object} Result object with overall stats
   */
  getAllCouponStats = async (dateRange = {}) => {
    try {
      let whereConditions = [];
      const params = [];
      let paramIndex = 1;

      if (dateRange.dateFrom) {
        whereConditions.push(`cc.clicked_at >= $${paramIndex}`);
        params.push(parseInt(dateRange.dateFrom));
        paramIndex++;
      }

      if (dateRange.dateTo) {
        whereConditions.push(`cc.clicked_at <= $${paramIndex}`);
        params.push(parseInt(dateRange.dateTo));
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const result = await this.query(
        `
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT cc.user_id) as unique_users,
          COUNT(DISTINCT cc.coupon_id) as total_coupons,
          COUNT(*) FILTER (WHERE cc.purchase_completed = TRUE) as purchases_completed,
          COALESCE(
            SUM(COALESCE(cu.final_price, (cc.metadata->>'final_price')::numeric)) FILTER (WHERE cc.purchase_completed = TRUE),
            0
          ) as total_revenue
        FROM coupon_clicks cc
        LEFT JOIN coupon_usage cu ON cc.coupon_usage_id = cu.id
        ${whereClause}
        `,
        params
      );

      if (result.success && result.data.length > 0) {
        const stats = result.data[0];
        const totalClicks = parseInt(stats.total_clicks) || 0;
        const purchasesCompleted = parseInt(stats.purchases_completed) || 0;
        const conversionRate = totalClicks > 0 ? (purchasesCompleted / totalClicks) * 100 : 0;

        return {
          success: true,
          data: {
            total_clicks: totalClicks,
            unique_users: parseInt(stats.unique_users) || 0,
            total_coupons: parseInt(stats.total_coupons) || 0,
            purchases_completed: purchasesCompleted,
            conversion_rate: parseFloat(conversionRate.toFixed(2)),
            total_revenue: parseFloat(stats.total_revenue) || 0,
          },
        };
      }

      return {
        success: false,
        error: "Failed to retrieve overall stats",
      };
    } catch (error) {
      logger.error("Error getting all coupon stats:", error);
      return {
        success: false,
        error: "Failed to retrieve overall stats",
      };
    }
  };

  /**
   * Generate comprehensive coupon usage statistics and reports
   * Implements requirements 5.1, 5.3, 5.4
   * @param {Object} filters - Filter options for date ranges and course-specific data
   * @returns {Object} Usage statistics and reports
   */
  getCouponUsageStatistics = async (filters = {}) => {
    try {
      const {
        startDate,
        endDate,
        courseId,
        couponId,
        status = "all",
        groupBy = "month", // 'day', 'week', 'month', 'year'
      } = filters;

      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      // Build WHERE conditions based on filters
      if (startDate) {
        whereConditions.push(`cu.used_at >= $${paramIndex}`);
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`cu.used_at <= $${paramIndex}`);
        queryParams.push(endDate);
        paramIndex++;
      }

      if (courseId) {
        whereConditions.push(`cu.course_id = $${paramIndex}`);
        queryParams.push(courseId);
        paramIndex++;
      }

      if (couponId) {
        whereConditions.push(`cu.coupon_id = $${paramIndex}`);
        queryParams.push(couponId);
        paramIndex++;
      }

      if (status !== "all") {
        whereConditions.push(`cu.payment_status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get overall statistics from coupon_usage table
      const overallStats = await this.query(
        `
        SELECT 
          COUNT(*) as total_usage_attempts,
          COUNT(CASE WHEN cu.payment_status = 'completed' THEN 1 END) as successful_redemptions,
          COUNT(CASE WHEN cu.payment_status = 'failed' THEN 1 END) as failed_redemptions,
          COUNT(CASE WHEN cu.payment_status = 'pending' THEN 1 END) as pending_redemptions,
          COALESCE(SUM(cu.original_price), 0) as total_original_value,
          COALESCE(SUM(cu.discount_amount), 0) as total_discount_given,
          COALESCE(SUM(cu.final_price), 0) as total_revenue_generated,
          COALESCE(AVG(cu.discount_amount), 0) as average_discount_amount,
          COUNT(DISTINCT cu.coupon_id) as unique_coupons_used,
          COUNT(DISTINCT cu.user_id) as unique_users,
          COUNT(DISTINCT cu.course_id) as unique_courses
        FROM coupon_usage cu
        ${whereClause}
      `,
        queryParams
      );

      // Also get total and active coupons count from coupons table
      const couponCounts = await this.query(
        `
        SELECT 
          COUNT(*) as total_coupons,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_coupons,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_coupons,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_coupons,
          COALESCE(SUM(usage_count), 0) as total_usage_count
        FROM coupons 
        WHERE status != 'deleted'
      `
      );

      // Get time-based usage trends
      const dateFormat = this.getDateFormatForGroupBy(groupBy);
      const trendStats = await this.query(
        `
        SELECT 
          ${dateFormat} as period,
          COUNT(*) as usage_count,
          COUNT(CASE WHEN cu.payment_status = 'completed' THEN 1 END) as successful_count,
          COALESCE(SUM(cu.discount_amount), 0) as total_discount,
          COALESCE(SUM(cu.final_price), 0) as revenue_generated
        FROM coupon_usage cu
        ${whereClause}
        GROUP BY ${dateFormat}
        ORDER BY period DESC
        LIMIT 50
      `,
        queryParams
      );

      // Calculate conversion rate
      const stats = overallStats.success ? overallStats.data[0] : {};
      const counts = couponCounts.success ? couponCounts.data[0] : {};
      
      const conversionRate =
        stats.total_usage_attempts > 0
          ? (stats.successful_redemptions / stats.total_usage_attempts) * 100
          : 0;

      // Calculate revenue impact
      const revenueImpact =
        stats.total_original_value > 0
          ? (stats.total_discount_given / stats.total_original_value) * 100
          : 0;

      return {
        success: true,
        data: {
          overview: {
            // Include coupon counts from coupons table
            total_coupons: parseInt(counts.total_coupons || 0),
            active_coupons: parseInt(counts.active_coupons || 0),
            expired_coupons: parseInt(counts.expired_coupons || 0),
            inactive_coupons: parseInt(counts.inactive_coupons || 0),
            // Include usage statistics from coupon_usage table
            total_usage: parseInt(stats.total_usage_attempts || 0),
            total_usage_attempts: parseInt(stats.total_usage_attempts || 0),
            successful_redemptions: parseInt(stats.successful_redemptions || 0),
            failed_redemptions: parseInt(stats.failed_redemptions || 0),
            pending_redemptions: parseInt(stats.pending_redemptions || 0),
            total_original_value: parseFloat(stats.total_original_value || 0),
            total_discount_given: parseFloat(stats.total_discount_given || 0),
            total_revenue_generated: parseFloat(stats.total_revenue_generated || 0),
            average_discount_amount: parseFloat(stats.average_discount_amount || 0),
            unique_coupons_used: parseInt(stats.unique_coupons_used || 0),
            unique_users: parseInt(stats.unique_users || 0),
            unique_courses: parseInt(stats.unique_courses || 0),
            conversion_rate: parseFloat(conversionRate.toFixed(2)),
            revenue_impact_percentage: parseFloat(revenueImpact.toFixed(2)),
            average_discount_percentage:
              stats.total_original_value > 0
                ? parseFloat(
                    (
                      (stats.total_discount_given /
                        stats.total_original_value) *
                      100
                    ).toFixed(2)
                  )
                : 0,
          },
          trends: trendStats.success ? trendStats.data : [],
          filters_applied: filters,
        },
      };
    } catch (error) {
      logger.error("Error generating coupon usage statistics:", error);
      return {
        success: false,
        error: "Failed to generate usage statistics",
      };
    }
  };

  /**
   * Get revenue impact and conversion rate analytics
   * Implements requirements 5.1, 5.3
   * @param {Object} filters - Filter options
   * @returns {Object} Revenue impact and conversion analytics
   */
  getRevenueImpactAnalytics = async (filters = {}) => {
    try {
      const { startDate, endDate, courseId } = filters;
      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      if (startDate) {
        whereConditions.push(`cu.used_at >= $${paramIndex}`);
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`cu.used_at <= $${paramIndex}`);
        queryParams.push(endDate);
        paramIndex++;
      }

      if (courseId) {
        whereConditions.push(`cu.course_id = $${paramIndex}`);
        queryParams.push(courseId);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get detailed revenue analytics
      const revenueAnalytics = await this.query(
        `
        SELECT 
          c.id as coupon_id,
          c.name as coupon_name,
          c.code as coupon_code,
          c.discount_type,
          c.discount_value,
          COUNT(cu.id) as total_uses,
          COUNT(CASE WHEN cu.payment_status = 'completed' THEN 1 END) as successful_uses,
          COALESCE(SUM(cu.original_price), 0) as total_original_revenue,
          COALESCE(SUM(cu.discount_amount), 0) as total_discount_given,
          COALESCE(SUM(cu.final_price), 0) as actual_revenue_generated,
          COALESCE(AVG(cu.discount_amount), 0) as avg_discount_per_use,
          COALESCE(AVG(cu.original_price), 0) as avg_original_price,
          COALESCE(AVG(cu.final_price), 0) as avg_final_price
        FROM coupons c
        LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id ${
          whereConditions.length > 0
            ? "AND " + whereConditions.join(" AND ").replace(/cu\./g, "cu.")
            : ""
        }
        WHERE c.status != 'deleted'
        GROUP BY c.id, c.name, c.code, c.discount_type, c.discount_value
        HAVING COUNT(cu.id) > 0 OR c.usage_count > 0
        ORDER BY actual_revenue_generated DESC, c.usage_count DESC
      `,
        queryParams
      );

      // Calculate overall metrics
      let totalOriginalRevenue = 0;
      let totalDiscountGiven = 0;
      let totalActualRevenue = 0;
      let totalSuccessfulUses = 0;
      let totalUses = 0;

      if (revenueAnalytics.success) {
        revenueAnalytics.data.forEach((coupon) => {
          totalOriginalRevenue += parseFloat(
            coupon.total_original_revenue || 0
          );
          totalDiscountGiven += parseFloat(coupon.total_discount_given || 0);
          totalActualRevenue += parseFloat(
            coupon.actual_revenue_generated || 0
          );
          totalSuccessfulUses += parseInt(coupon.successful_uses || 0);
          totalUses += parseInt(coupon.total_uses || 0);
        });
      }

      const overallConversionRate =
        totalUses > 0 ? (totalSuccessfulUses / totalUses) * 100 : 0;
      const revenueImpactPercentage =
        totalOriginalRevenue > 0
          ? (totalDiscountGiven / totalOriginalRevenue) * 100
          : 0;

      return {
        success: true,
        data: {
          summary: {
            total_original_revenue: totalOriginalRevenue,
            total_discount_given: totalDiscountGiven,
            total_actual_revenue: totalActualRevenue,
            revenue_saved_percentage: parseFloat(
              revenueImpactPercentage.toFixed(2)
            ),
            overall_conversion_rate: parseFloat(
              overallConversionRate.toFixed(2)
            ),
            total_successful_uses: totalSuccessfulUses,
            total_uses: totalUses,
          },
          coupon_performance: revenueAnalytics.success
            ? revenueAnalytics.data
            : [],
          filters_applied: filters,
        },
      };
    } catch (error) {
      logger.error("Error generating revenue impact analytics:", error);
      return {
        success: false,
        error: "Failed to generate revenue impact analytics",
      };
    }
  };

  /**
   * Get top performing coupons analysis
   * Implements requirements 5.1, 5.4
   * @param {Object} options - Analysis options
   * @returns {Object} Top performing coupons data
   */
  getTopPerformingCoupons = async (options = {}) => {
    try {
      const {
        limit = 10,
        sortBy = "revenue", // 'revenue', 'usage', 'conversion', 'discount'
        startDate,
        endDate,
        courseId,
      } = options;

      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      if (startDate) {
        whereConditions.push(`cu.used_at >= $${paramIndex}`);
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`cu.used_at <= $${paramIndex}`);
        queryParams.push(endDate);
        paramIndex++;
      }

      if (courseId) {
        whereConditions.push(`cu.course_id = $${paramIndex}`);
        queryParams.push(courseId);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `AND ${whereConditions.join(" AND ")}`
          : "";

      // Determine ORDER BY clause based on sortBy parameter
      let orderByClause;
      switch (sortBy) {
        case "usage":
          orderByClause = "total_uses DESC";
          break;
        case "conversion":
          orderByClause = "conversion_rate DESC";
          break;
        case "discount":
          orderByClause = "total_discount_given DESC";
          break;
        case "revenue":
        default:
          orderByClause = "actual_revenue_generated DESC";
          break;
      }

      const topCoupons = await this.query(
        `
        SELECT 
          c.id,
          c.name,
          c.code,
          c.discount_type,
          c.discount_value,
          c.usage_limit,
          c.usage_count,
          c.status,
          c.start_time,
          c.end_time,
          COUNT(cu.id) as total_uses,
          COUNT(CASE WHEN cu.payment_status = 'completed' THEN 1 END) as successful_uses,
          COUNT(CASE WHEN cu.payment_status = 'failed' THEN 1 END) as failed_uses,
          COALESCE(SUM(cu.original_price), 0) as total_original_revenue,
          COALESCE(SUM(cu.discount_amount), 0) as total_discount_given,
          COALESCE(SUM(cu.final_price), 0) as actual_revenue_generated,
          COALESCE(AVG(cu.discount_amount), 0) as avg_discount_per_use,
          CASE 
            WHEN COUNT(cu.id) > 0 THEN 
              ROUND((COUNT(CASE WHEN cu.payment_status = 'completed' THEN 1 END)::numeric / COUNT(cu.id) * 100), 2)
            ELSE 0 
          END as conversion_rate,
          COUNT(DISTINCT cu.user_id) as unique_users,
          COUNT(DISTINCT cu.course_id) as unique_courses_purchased
        FROM coupons c
        LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id ${whereClause}
        WHERE c.status != 'deleted'
        GROUP BY c.id, c.name, c.code, c.discount_type, c.discount_value,
                 c.usage_limit, c.usage_count, c.status, c.start_time, c.end_time
        HAVING COUNT(cu.id) > 0 OR c.usage_count > 0
        ORDER BY ${orderByClause}
        LIMIT $${paramIndex}
      `,
        [...queryParams, limit]
      );

      // Get course breakdown for top coupons if no specific course filter
      let courseBreakdown = [];
      if (!courseId && topCoupons.success && topCoupons.data.length > 0) {
        const topCouponIds = topCoupons.data.slice(0, 5).map((c) => c.id);

        if (topCouponIds.length > 0) {
          const courseBreakdownQuery = await this.query(
            `
            SELECT 
              cu.coupon_id,
              c.title as course_title,
              co.name as course_name,
              COUNT(cu.id) as usage_count,
              COALESCE(SUM(cu.discount_amount), 0) as total_discount,
              COALESCE(SUM(cu.final_price), 0) as revenue_generated
            FROM coupon_usage cu
            JOIN course co ON cu.course_id = co.id
            JOIN coupons c ON cu.coupon_id = c.id
            WHERE cu.coupon_id = ANY($1) ${
              whereConditions.length > 0
                ? "AND " + whereConditions.join(" AND ")
                : ""
            }
            GROUP BY cu.coupon_id, co.id, co.title, c.name
            ORDER BY cu.coupon_id, usage_count DESC
          `,
            [topCouponIds, ...queryParams.slice(0, -1)]
          );

          if (courseBreakdownQuery.success) {
            courseBreakdown = courseBreakdownQuery.data;
          }
        }
      }

      return {
        success: true,
        data: {
          top_coupons: topCoupons.success ? topCoupons.data : [],
          course_breakdown: courseBreakdown,
          analysis_criteria: {
            sort_by: sortBy,
            limit: limit,
            filters_applied: options,
          },
        },
      };
    } catch (error) {
      logger.error("Error getting top performing coupons:", error);
      return {
        success: false,
        error: "Failed to get top performing coupons",
      };
    }
  };

  /**
   * Get detailed coupon usage report with filtering capabilities
   * Implements requirements 5.1, 5.3, 5.4
   * @param {number} couponId - Specific coupon ID (optional)
   * @param {Object} filters - Filter options
   * @returns {Object} Detailed usage report
   */
  getCouponUsageReport = async (couponId = null, filters = {}) => {
    try {
      const {
        startDate,
        endDate,
        courseId,
        userId,
        paymentStatus,
        page = 1,
        limit = 50,
      } = filters;

      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      if (couponId) {
        whereConditions.push(`cu.coupon_id = $${paramIndex}`);
        queryParams.push(couponId);
        paramIndex++;
      }

      if (startDate) {
        whereConditions.push(`cu.used_at >= $${paramIndex}`);
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`cu.used_at <= $${paramIndex}`);
        queryParams.push(endDate);
        paramIndex++;
      }

      if (courseId) {
        whereConditions.push(`cu.course_id = $${paramIndex}`);
        queryParams.push(courseId);
        paramIndex++;
      }

      if (userId) {
        whereConditions.push(`cu.user_id = $${paramIndex}`);
        queryParams.push(userId);
        paramIndex++;
      }

      if (paymentStatus) {
        whereConditions.push(`cu.payment_status = $${paramIndex}`);
        queryParams.push(paymentStatus);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await this.query(
        `
        SELECT COUNT(*) as total
        FROM coupon_usage cu
        ${whereClause}
      `,
        queryParams
      );

      const total = countResult.success
        ? parseInt(countResult.data[0].total)
        : 0;

      // Get detailed usage data
      const usageData = await this.query(
        `
        SELECT 
          cu.id,
          cu.coupon_id,
          c.name as coupon_name,
          c.code as coupon_code,
          cu.user_id,
          cu.course_id,
          co.title as course_title,
          cu.original_price,
          cu.discount_amount,
          cu.final_price,
          cu.used_at,
          cu.payment_status,
          cu.metadata,
          ROUND((cu.discount_amount / NULLIF(cu.original_price, 0) * 100), 2) as discount_percentage
        FROM coupon_usage cu
        JOIN coupons c ON cu.coupon_id = c.id
        LEFT JOIN course co ON cu.course_id = co.id
        ${whereClause}
        ORDER BY cu.used_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
        [...queryParams, limit, offset]
      );

      return {
        success: true,
        data: {
          usage_records: usageData.success ? usageData.data : [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            total_pages: Math.ceil(total / limit),
          },
          filters_applied: filters,
        },
      };
    } catch (error) {
      logger.error("Error generating coupon usage report:", error);
      return {
        success: false,
        error: "Failed to generate usage report",
      };
    }
  };

  /**
   * Helper method to get date format for groupBy parameter
   * @param {string} groupBy - Grouping period
   * @returns {string} SQL date format expression
   */
  getDateFormatForGroupBy = (groupBy) => {
    switch (groupBy) {
      case "day":
        return "to_char(to_timestamp(cu.used_at), 'YYYY-MM-DD')";
      case "week":
        return "to_char(to_timestamp(cu.used_at), 'YYYY-\"W\"WW')";
      case "year":
        return "to_char(to_timestamp(cu.used_at), 'YYYY')";
      case "month":
      default:
        return "to_char(to_timestamp(cu.used_at), 'YYYY-MM')";
    }
  };
}

module.exports = { CouponAnalyticsService };
