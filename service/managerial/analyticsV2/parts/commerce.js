// Coupons and payments.
// Part of AnalyticsV2Service (../analyticsV2Service.js), which callers use.
const { AnalyticsV2Base } = require("./base");
const { parseDateRange } = require("../../../../util/analyticsV2/dateUtils");
const { validateLimit, validateOffset } = require("../../../../util/analyticsV2/queryUtils");
const logger = require('../../../../util/logger');

class CommerceAnalyticsService extends AnalyticsV2Base {
  constructor() {
    super();
  }

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
      logger.error("Error in getCouponOverview:", error);
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
      logger.error("Error in getCouponPerformance:", error);
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
      logger.error("Error in getPaymentOverview:", error);
      return {
        success: false,
        error: "Internal server error",
      };
    }
  };
}

module.exports = { CommerceAnalyticsService };
