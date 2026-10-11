// Coupon link clicks and their conversion to purchases.
// Part of CouponService (service/managerial/coupon.js), which callers use.
const { Service } = require("../../base");
const { parsePagination, pageMeta } = require("../../../util/pagination");
const logger = require('../../../util/logger');

class CouponClickTrackingService extends Service {
  constructor() {
    super();
  }

  /**
   * Track when a coupon is applied (clicked)
   * @param {number} couponId - Coupon ID
   * @param {number} userId - User ID who applied the coupon
   * @param {number|null} courseId - Course ID (if applicable)
   * @param {number|null} bundleId - Bundle ID (if applicable)
   * @param {Object} requestDetails - Request details (userAgent)
   * @returns {Object} Result object with success status and clickId
   */
  trackCouponClick = async (couponId, userId, courseId = null, bundleId = null, requestDetails = {}) => {
    try {
      if (!couponId || !userId) {
        return {
          success: false,
          error: "Coupon ID and User ID are required",
        };
      }

      // Must provide either courseId OR bundleId, but not both
      if (!courseId && !bundleId) {
        return {
          success: false,
          error: "Either courseId or bundleId is required",
        };
      }

      if (courseId && bundleId) {
        return {
          success: false,
          error: "Provide either courseId or bundleId, not both",
        };
      }

      const currentTime = Math.floor(Date.now() / 1000);

      // Insert click record
      const result = await this.query(
        `
        INSERT INTO coupon_clicks (
          coupon_id, user_id, course_id, bundle_id,
          clicked_at, user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        `,
        [
          couponId,
          userId,
          courseId || null,
          bundleId || null,
          currentTime,
          requestDetails.userAgent || null,
          JSON.stringify(requestDetails.metadata || {}),
        ]
      );

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: {
            clickId: result.data[0].id
          },
          message: "Coupon click tracked successfully",
        };
      }

      return {
        success: false,
        error: "Failed to track coupon click",
      };
    } catch (error) {
      logger.error("Error tracking coupon click:", error);
      return {
        success: false,
        error: "Failed to track coupon click due to system error",
      };
    }
  };

  /**
   * Link click tracking to purchase completion
   * Called from recordUsage() when payment_status = 'completed'
   * @param {number} couponId - Coupon ID
   * @param {number} userId - User ID
   * @param {number|null} courseId - Course ID
   * @param {number|null} bundleId - Bundle ID
   * @param {number} couponUsageId - Coupon usage ID
   * @param {string} transactionId - Transaction ID
   * @returns {Object} Result object with success status
   */
  linkClickToPurchase = async (couponId, userId, courseId, bundleId, couponUsageId, transactionId, bookId = null) => {
    try {
      if (!couponId || !userId || !couponUsageId || !transactionId) {
        return {
          success: false,
          error: "Coupon ID, User ID, Coupon Usage ID, and Transaction ID are required",
        };
      }

      const currentTime = Math.floor(Date.now() / 1000);

      // Find matching click record
      // Match by coupon_id + user_id + course_id/bundle_id
      // Only match clicks that haven't been linked yet (purchase_completed = FALSE)
      // Within reasonable time window (last 7 days)
      const timeWindow = currentTime - (7 * 24 * 60 * 60); // 7 days ago

      // Build SELECT query to find matching click
      let selectQuery = `
        SELECT id
        FROM coupon_clicks
        WHERE 
          coupon_id = $1
          AND user_id = $2
          AND purchase_completed = FALSE
          AND clicked_at >= $3
      `;

      const selectParams = [couponId, userId, timeWindow];
      let paramIndex = 4;

      if (courseId) {
        selectQuery += ` AND course_id = $${paramIndex}`;
        selectParams.push(courseId);
        paramIndex++;
      } else if (bundleId) {
        selectQuery += ` AND bundle_id = $${paramIndex}`;
        selectParams.push(bundleId);
        paramIndex++;
      } else if (bookId) {
        selectQuery += ` AND book_id = $${paramIndex}`;
        selectParams.push(bookId);
        paramIndex++;
      } else {
        selectQuery += ` AND course_id IS NULL AND bundle_id IS NULL AND book_id IS NULL`;
      }

      selectQuery += `
        ORDER BY clicked_at DESC
        LIMIT 1
      `;

      // Find the matching click
      const selectResult = await this.query(selectQuery, selectParams);

      if (!selectResult.success || selectResult.data.length === 0) {
        // No matching click found - this is OK, not all clicks result in purchases
        return {
          success: true,
          data: {
            linked: false,
          },
          message: "No matching click found to link (this is normal)",
        };
      }

      const clickId = selectResult.data[0].id;

      // Now update the found click
      const result = await this.query(
        `
        UPDATE coupon_clicks
        SET 
          coupon_usage_id = $1,
          purchase_completed = TRUE,
          purchase_completed_at = $2,
          transaction_id = $3
        WHERE id = $4
        RETURNING id
        `,
        [couponUsageId, currentTime, transactionId, clickId]
      );

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: {
            clickId: result.data[0].id,
            linked: true,
          },
          message: "Click linked to purchase successfully",
        };
      }

      return {
        success: false,
        error: "Failed to update click record",
      };
    } catch (error) {
      logger.error("Error linking click to purchase:", error);
      return {
        success: false,
        error: "Failed to link click to purchase due to system error",
      };
    }
  };

  /**
   * Get all clicks for a specific coupon
   * @param {number} couponId - Coupon ID
   * @param {Object} filters - Filter options (dateFrom, dateTo, purchaseCompleted, page, limit)
   * @returns {Object} Result object with click records
   */
  getCouponClicks = async (couponId, filters = {}) => {
    try {
      if (!couponId) {
        return {
          success: false,
          error: "Coupon ID is required",
        };
      }

      const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });

      let whereConditions = ['cc.coupon_id = $1'];
      const params = [couponId];
      let paramIndex = 2;

      // Date range filter
      if (filters.dateFrom) {
        whereConditions.push(`cc.clicked_at >= $${paramIndex}`);
        params.push(parseInt(filters.dateFrom));
        paramIndex++;
      }

      if (filters.dateTo) {
        whereConditions.push(`cc.clicked_at <= $${paramIndex}`);
        params.push(parseInt(filters.dateTo));
        paramIndex++;
      }

      // Purchase completed filter
      if (filters.purchaseCompleted !== undefined) {
        whereConditions.push(`cc.purchase_completed = $${paramIndex}`);
        params.push(filters.purchaseCompleted === true || filters.purchaseCompleted === 'true');
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.query(
        `
        SELECT COUNT(*) as total
        FROM coupon_clicks cc
        ${whereClause}
        `,
        params
      );

      const total = countResult.success ? parseInt(countResult.data[0].total) : 0;

      // Get click records with user and coupon details
      const dataResult = await this.query(
        `
        SELECT 
          cc.id,
          cc.coupon_id,
          c.code as coupon_code,
          cc.user_id,
          ma_user.name as user_name,
          ma_user.email as user_email,
          ma_user.phone as user_phone,
          cc.course_id,
          co.title as course_title,
          cc.bundle_id,
          b.title as bundle_name,
          cc.clicked_at,
          cc.user_agent,
          cc.metadata,
          cc.purchase_completed,
          cc.purchase_completed_at,
          cc.transaction_id,
          cc.coupon_usage_id,
          COALESCE(cu.final_price, (cc.metadata->>'final_price')::numeric) as final_price,
          COALESCE(cu.discount_amount, (cc.metadata->>'discount_amount')::numeric) as discount_amount,
          COALESCE((cc.metadata->>'original_price')::numeric, cu.original_price) as original_price
        FROM coupon_clicks cc
        LEFT JOIN coupons c ON cc.coupon_id = c.id
        LEFT JOIN managerial_auth ma_user ON cc.user_id = ma_user.id
        LEFT JOIN course co ON cc.course_id = co.id
        LEFT JOIN bundle b ON cc.bundle_id = b.id
        LEFT JOIN coupon_usage cu ON cc.coupon_usage_id = cu.id
        ${whereClause}
        ORDER BY cc.clicked_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        [...params, limit, offset]
      );

      if (dataResult.success) {
        return {
          success: true,
          data: {
            clicks: dataResult.data,
            pagination: pageMeta(page, limit, total),
          },
        };
      }

      return dataResult;
    } catch (error) {
      logger.error("Error getting coupon clicks:", error);
      return {
        success: false,
        error: "Failed to retrieve coupon clicks",
      };
    }
  };

  /**
   * Get all coupon clicks (admin only)
   * @param {Object} filters - Filter options (couponId, dateFrom, dateTo, purchaseCompleted, page, limit)
   * @returns {Object} Result object with click records
   */
  getAllCouponClicks = async (filters = {}) => {
    try {
      const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });

      let whereConditions = [];
      const params = [];
      let paramIndex = 1;

      // Coupon filter
      if (filters.couponId) {
        whereConditions.push(`cc.coupon_id = $${paramIndex}`);
        params.push(parseInt(filters.couponId));
        paramIndex++;
      }

      // Date range filter
      if (filters.dateFrom) {
        whereConditions.push(`cc.clicked_at >= $${paramIndex}`);
        params.push(parseInt(filters.dateFrom));
        paramIndex++;
      }

      if (filters.dateTo) {
        whereConditions.push(`cc.clicked_at <= $${paramIndex}`);
        params.push(parseInt(filters.dateTo));
        paramIndex++;
      }

      // Purchase completed filter
      if (filters.purchaseCompleted !== undefined) {
        whereConditions.push(`cc.purchase_completed = $${paramIndex}`);
        params.push(filters.purchaseCompleted === true || filters.purchaseCompleted === 'true');
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.query(
        `
        SELECT COUNT(*) as total
        FROM coupon_clicks cc
        ${whereClause}
        `,
        params
      );

      const total = countResult.success ? parseInt(countResult.data[0].total) : 0;

      // Get click records
      const dataResult = await this.query(
        `
        SELECT 
          cc.id,
          cc.coupon_id,
          c.code as coupon_code,
          cc.user_id,
          ma_user.name as user_name,
          ma_user.email as user_email,
          ma_user.phone as user_phone,
          cc.course_id,
          co.title as course_title,
          cc.bundle_id,
          b.title as bundle_name,
          cc.clicked_at,
          cc.user_agent,
          cc.metadata,
          cc.purchase_completed,
          cc.purchase_completed_at,
          cc.transaction_id,
          cc.coupon_usage_id,
          COALESCE(cu.final_price, (cc.metadata->>'final_price')::numeric) as final_price,
          COALESCE(cu.discount_amount, (cc.metadata->>'discount_amount')::numeric) as discount_amount,
          COALESCE((cc.metadata->>'original_price')::numeric, cu.original_price) as original_price
        FROM coupon_clicks cc
        LEFT JOIN coupons c ON cc.coupon_id = c.id
        LEFT JOIN managerial_auth ma_user ON cc.user_id = ma_user.id
        LEFT JOIN course co ON cc.course_id = co.id
        LEFT JOIN bundle b ON cc.bundle_id = b.id
        LEFT JOIN coupon_usage cu ON cc.coupon_usage_id = cu.id
        ${whereClause}
        ORDER BY cc.clicked_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        [...params, limit, offset]
      );

      if (dataResult.success) {
        return {
          success: true,
          data: {
            clicks: dataResult.data,
            pagination: pageMeta(page, limit, total),
          },
        };
      }

      return dataResult;
    } catch (error) {
      logger.error("Error getting all coupon clicks:", error);
      return {
        success: false,
        error: "Failed to retrieve coupon clicks",
      };
    }
  };

  /**
   * Get detailed information about a specific click
   * @param {number} clickId - Click ID
   * @returns {Object} Result object with click details
   */
  getCouponClickDetails = async (clickId) => {
    try {
      if (!clickId) {
        return {
          success: false,
          error: "Click ID is required",
        };
      }

      const result = await this.query(
        `
        SELECT 
          cc.id,
          cc.coupon_id,
          c.code as coupon_code,
          c.name as coupon_name,
          c.discount_type,
          c.discount_value,
          cc.user_id,
          ma_user.name as user_name,
          ma_user.email as user_email,
          ma_user.phone as user_phone,
          cc.course_id,
          co.title as course_title,
          cc.bundle_id,
          b.title as bundle_name,
          cc.clicked_at,
          cc.user_agent,
          cc.metadata,
          cc.purchase_completed,
          cc.purchase_completed_at,
          cc.transaction_id,
          cc.coupon_usage_id,
          COALESCE(cu.original_price, (cc.metadata->>'original_price')::numeric) as original_price,
          COALESCE(cu.discount_amount, (cc.metadata->>'discount_amount')::numeric) as discount_amount,
          COALESCE(cu.final_price, (cc.metadata->>'final_price')::numeric) as final_price,
          cu.payment_status
        FROM coupon_clicks cc
        LEFT JOIN coupons c ON cc.coupon_id = c.id
        LEFT JOIN managerial_auth ma_user ON cc.user_id = ma_user.id
        LEFT JOIN course co ON cc.course_id = co.id
        LEFT JOIN bundle b ON cc.bundle_id = b.id
        LEFT JOIN coupon_usage cu ON cc.coupon_usage_id = cu.id
        WHERE cc.id = $1
        `,
        [clickId]
      );

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: result.data[0],
        };
      }

      return {
        success: false,
        error: "Click not found",
      };
    } catch (error) {
      logger.error("Error getting click details:", error);
      return {
        success: false,
        error: "Failed to retrieve click details",
      };
    }
  };

  /**
   * Get coupon conversion statistics (click-to-purchase rate)
   * @param {number} couponId - Coupon ID
   * @param {Object} dateRange - Optional date range (dateFrom, dateTo)
   * @returns {Object} Result object with conversion stats
   */
  getCouponConversionStats = async (couponId, dateRange = {}) => {
    try {
      if (!couponId) {
        return {
          success: false,
          error: "Coupon ID is required",
        };
      }

      let whereConditions = ['cc.coupon_id = $1'];
      const params = [couponId];
      let paramIndex = 2;

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

      const whereClause = whereConditions.join(' AND ');

      const result = await this.query(
        `
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT cc.user_id) as unique_users,
          COUNT(*) FILTER (WHERE cc.purchase_completed = TRUE) as purchases_completed,
          COALESCE(
            SUM(COALESCE(cu.final_price, (cc.metadata->>'final_price')::numeric)) FILTER (WHERE cc.purchase_completed = TRUE),
            0
          ) as total_revenue
        FROM coupon_clicks cc
        LEFT JOIN coupon_usage cu ON cc.coupon_usage_id = cu.id
        WHERE ${whereClause}
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
            purchases_completed: purchasesCompleted,
            conversion_rate: parseFloat(conversionRate.toFixed(2)),
            total_revenue: parseFloat(stats.total_revenue) || 0,
          },
        };
      }

      return {
        success: false,
        error: "Failed to retrieve conversion stats",
      };
    } catch (error) {
      logger.error("Error getting coupon conversion stats:", error);
      return {
        success: false,
        error: "Failed to retrieve conversion stats",
      };
    }
  };

  /**
   * Get detailed click analytics for a coupon
   * @param {number} couponId - Coupon ID
   * @param {Object} dateRange - Optional date range (dateFrom, dateTo)
   * @returns {Object} Result object with detailed analytics
   */
  getCouponClickAnalytics = async (couponId, dateRange = {}) => {
    try {
      const conversionStats = await this.getCouponConversionStats(couponId, dateRange);
      
      if (!conversionStats.success) {
        return conversionStats;
      }

      // Get clicks by day
      let whereConditions = ['cc.coupon_id = $1'];
      const params = [couponId];
      let paramIndex = 2;

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

      const whereClause = whereConditions.join(' AND ');

      const dailyStats = await this.query(
        `
        SELECT 
          DATE(to_timestamp(cc.clicked_at)) as date,
          COUNT(*) as clicks,
          COUNT(*) FILTER (WHERE cc.purchase_completed = TRUE) as purchases
        FROM coupon_clicks cc
        WHERE ${whereClause}
        GROUP BY DATE(to_timestamp(cc.clicked_at))
        ORDER BY date DESC
        `,
        params
      );

      return {
        success: true,
        data: {
          ...conversionStats.data,
          daily_stats: dailyStats.success ? dailyStats.data : [],
        },
      };
    } catch (error) {
      logger.error("Error getting coupon click analytics:", error);
      return {
        success: false,
        error: "Failed to retrieve click analytics",
      };
    }
  };
}

module.exports = { CouponClickTrackingService };
