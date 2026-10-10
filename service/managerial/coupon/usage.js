// Coupon usage: recorded as 'pending' at checkout, completed by the IPN, plus the
// payment ↔ coupon tracking rows.
// Part of CouponService (service/managerial/coupon.js), which callers use.
const { Service } = require("../../base");
const CouponAuditLogger = require("../CouponAuditLogger");
const logger = require('../../../util/logger');

class CouponUsageService extends Service {
  // `clicks` (CouponClickTrackingService) links a completed usage to the click that led to it.
  constructor(clicks) {
    super();
    this.clicks = clicks;
  }

  /**
   * Record coupon usage with proper transaction handling and dedicated client connections
   * Implements requirements 7.4, 7.5, 9.1, 9.2, 9.4
   * @param {number} couponId - Coupon ID
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {Object} priceData - Price calculation data
   * @param {string} paymentStatus - Payment status (default: 'pending')
   * @returns {Object} Usage recording result
   */
  recordUsage = async (
    couponId,
    userId,
    courseId,
    bundleId = null,
    priceData,
    paymentStatus = "pending",
    transactionId = null,
    bookId = null
  ) => {
    try {
      // Validate input parameters
      // Exactly one of courseId / bundleId / bookId must be provided
      if (!couponId || !userId || (!courseId && !bundleId && !bookId) || !priceData) {
        return {
          success: false,
          error: "Missing required parameters for coupon usage recording",
        };
      }

      const { originalPrice, discountAmount, finalPrice } = priceData;

      // Validate price data
      if (originalPrice < 0 || discountAmount < 0 || finalPrice < 0) {
        return {
          success: false,
          error: "Invalid price data - prices cannot be negative",
        };
      }

      const currentTime = Math.floor(Date.now() / 1000);
      // Set only when a new usage row is committed; the follow-up work below needs it.
      let committedUsageId = null;

      const result = await this.withTransaction(async (client) => {
        // Lock the coupon row to prevent race conditions (requirement 9.2)
        const couponCheck = await client.query(
          `
          SELECT id, usage_count, usage_limit, status, start_time, end_time
          FROM coupons 
          WHERE id = $1
          FOR UPDATE
          `,
          [couponId]
        );

        if (couponCheck.rows.length === 0) {
          return {
            success: false,
            error: "Coupon not found",
          };
        }

        const coupon = couponCheck.rows[0];

        // Validate coupon status and timing
        // NOTE: In IPN context, we're more lenient because payment already succeeded with discount
        // But we still check to prevent obvious errors (deleted coupons, etc.)
        if (coupon.status === "deleted") {
          return {
            success: false,
            error: "Coupon has been deleted",
          };
        }

        // For expired/inactive coupons, we still allow recording if payment_status is 'completed'
        // because the discount was already applied during payment. This prevents loss of usage data.
        // However, we log a warning for audit purposes.
        if (coupon.status !== "active") {
          console.warn("recordUsage: Recording usage for inactive coupon (payment already completed with discount)", {
            couponId,
            status: coupon.status,
            paymentStatus
          });
        }

        if (currentTime < coupon.start_time || currentTime > coupon.end_time) {
          // If payment_status is 'completed', we still record usage (discount was already given)
          // But log a warning for audit trail
          if (paymentStatus === "completed") {
            console.warn("recordUsage: Recording usage for expired/not-started coupon (payment already completed with discount)", {
              couponId,
              currentTime,
              startTime: coupon.start_time,
              endTime: coupon.end_time,
              paymentStatus
            });
            // Continue with recording - don't return error
          } else if (paymentStatus === "pending") {
            // EDGE CASE FIX: Handle two scenarios differently:
            // 1. Coupon expired (currentTime > end_time) - allow grace period
            // 2. Coupon not started yet (currentTime < start_time) - NO grace period (business rule)
            
            if (currentTime > coupon.end_time) {
              // Coupon expired - allow grace period for race conditions
              const timeSinceExpiry = currentTime - coupon.end_time;
              const GRACE_PERIOD_SECONDS = 300; // 5 minutes
              
              if (timeSinceExpiry <= GRACE_PERIOD_SECONDS) {
                console.warn("recordUsage: Recording pending usage for recently expired coupon (within grace period)", {
                  couponId,
                  currentTime,
                  endTime: coupon.end_time,
                  timeSinceExpiry,
                  paymentStatus
                });
                // Continue with recording - don't return error
              } else {
                // Coupon expired too long ago - reject
                return {
                  success: false,
                  error: "Coupon has expired",
                };
              }
            } else if (currentTime < coupon.start_time) {
              // Coupon not started yet - NO grace period (business rule: coupons only usable after start time)
              return {
                success: false,
                error: "Coupon is not yet active",
              };
            }
          } else {
            // For other statuses (failed), reject expired/not-started coupons
            return {
              success: false,
              error: "Coupon is not valid at this time",
            };
          }
        }

        // Check usage limit with current locked count (requirement 9.4)
        // NOTE: If payment_status is 'completed', we're more lenient because discount was already applied
        // But we still check to prevent going way over limit
        if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
          // If payment already completed, we must honor it (discount was already given)
          if (paymentStatus === "completed") {
            console.warn("recordUsage: Recording usage despite limit reached (payment already completed with discount)", {
              couponId,
              currentUsage: coupon.usage_count,
              usageLimit: coupon.usage_limit,
              paymentStatus
            });
            // Continue with recording - don't return error
          } else if (paymentStatus === "pending") {
            // EDGE CASE FIX: For pending payments, check if we're at exactly the limit
            // If so, allow (user validated before limit was reached, race condition)
            // But reject if way over limit (safety check)
            const OVER_LIMIT_THRESHOLD = 5; // Allow up to 5 over limit for pending
            
            if (coupon.usage_count < coupon.usage_limit + OVER_LIMIT_THRESHOLD) {
              console.warn("recordUsage: Recording pending usage despite limit reached (within threshold - race condition)", {
                couponId,
                currentUsage: coupon.usage_count,
                usageLimit: coupon.usage_limit,
                paymentStatus
              });
              // Continue with recording - don't return error
            } else {
              // Way over limit - reject for safety

              // Log usage limit exceeded attempt
              CouponAuditLogger.logCouponUsage(
                couponId,
                "unknown",
                courseId,
                priceData,
                { id: userId, type: "user" },
                "failure",
                "Coupon usage limit exceeded"
              );

              return {
                success: false,
                error: "Coupon usage limit exceeded",
              };
            }
          } else {
            // For other statuses (failed), reject if limit reached

            // Log usage limit exceeded attempt
            CouponAuditLogger.logCouponUsage(
              couponId,
              "unknown",
              courseId,
              priceData,
              { id: userId, type: "user" },
              "failure",
              "Coupon usage limit exceeded"
            );

            return {
              success: false,
              error: "Coupon usage limit exceeded",
            };
          }
        }

        // EDGE CASE FIX: Check if user has already used this coupon (ANY status - pending or completed)
        // This prevents race conditions where user tries to use same coupon twice simultaneously
        let existingUsage;
        if (courseId) {
          existingUsage = await client.query(
            `
            SELECT id, payment_status FROM coupon_usage
            WHERE coupon_id = $1 AND user_id = $2 AND course_id = $3
            `,
            [couponId, userId, courseId]
          );
        } else if (bundleId) {
          existingUsage = await client.query(
            `
            SELECT id, payment_status FROM coupon_usage
            WHERE coupon_id = $1 AND user_id = $2 AND bundle_id = $3
            `,
            [couponId, userId, bundleId]
          );
        } else if (bookId) {
          existingUsage = await client.query(
            `
            SELECT id, payment_status FROM coupon_usage
            WHERE coupon_id = $1 AND user_id = $2 AND book_id = $3
            `,
            [couponId, userId, bookId]
          );
        } else {
          return {
            success: false,
            error: "Either courseId, bundleId or bookId must be provided",
          };
        }

        if (existingUsage.rows.length > 0) {
          // Check if there's a completed usage (definite duplicate)
          const completedUsage = existingUsage.rows.find(row => row.payment_status === 'completed');
          if (completedUsage) {
            return {
              success: false,
              error: courseId
                ? "You have already used this coupon for this course"
                : bundleId
                  ? "You have already used this coupon for this bundle"
                  : "You have already used this coupon for this book",
            };
          }
          
          // Check if there's a pending usage (possible duplicate - same transaction or different)
          const pendingUsage = existingUsage.rows.find(row => row.payment_status === 'pending');
          if (pendingUsage) {
            // If same transaction_id, allow (idempotency for retries)
            // If different transaction_id, reject (user trying to use coupon twice)
            const existingTransactionCheck = await client.query(
              `SELECT transaction_id FROM coupon_usage WHERE id = $1`,
              [pendingUsage.id]
            );
            
            if (existingTransactionCheck.rows.length > 0) {
              const existingTransactionId = existingTransactionCheck.rows[0].transaction_id;
              if (existingTransactionId !== transactionId) {
                return {
                  success: false,
                  error: courseId
                    ? "You already have a pending payment with this coupon for this course"
                    : bundleId
                      ? "You already have a pending payment with this coupon for this bundle"
                      : "You already have a pending payment with this coupon for this book",
                };
              }
              
              // CRITICAL FIX: Same transaction_id - return early for idempotency
              // This prevents eligibility checks from running and potentially rejecting a valid retry
              // If payment_status is 'completed' and we're trying to record 'pending', update it
              if (paymentStatus === 'completed') {
                // Update existing pending record to completed
                const updateResult = await client.query(
                  `UPDATE coupon_usage SET payment_status = $1 WHERE id = $2 RETURNING id`,
                  ['completed', pendingUsage.id]
                );
                return {
                  success: true,
                  data: {
                    usageId: pendingUsage.id,
                    couponId,
                    newUsageCount: null, // Don't increment again
                    usageLimit: coupon.usage_limit,
                    recordedAt: Math.floor(Date.now() / 1000),
                    updated: true
                  },
                  message: "Coupon usage status updated to completed (idempotency)",
                };
              }
              
              // Same transaction_id and same status - return existing record (idempotency)
              return {
                success: true,
                data: {
                  usageId: pendingUsage.id,
                  couponId,
                  newUsageCount: null, // Don't increment again
                  usageLimit: coupon.usage_limit,
                  recordedAt: Math.floor(Date.now() / 1000),
                  alreadyExists: true
                },
                message: "Coupon usage already recorded (idempotency)",
              };
            }
          }
        }

        // Verify eligibility
        // NOTE: If payment_status is 'completed', we're more lenient because discount was already applied
        // But we still check to log warnings for audit purposes
        if (courseId) {
          const courseEligibility = await client.query(
            `
            SELECT cc.coupon_id 
            FROM coupon_courses cc 
            WHERE cc.coupon_id = $1 AND cc.course_id = $2
            `,
            [couponId, courseId]
          );

          if (courseEligibility.rows.length === 0) {
            // If payment already completed, we must honor it (discount was already given)
            if (paymentStatus === "completed") {
              console.warn("recordUsage: Recording usage despite course not eligible (payment already completed with discount)", {
                couponId,
                courseId,
                paymentStatus
              });
              // Continue with recording - don't return error
            } else {
              // For pending payments, we can still reject if not eligible
              return {
                success: false,
                error: "Coupon not applicable for this course",
              };
            }
          }
        } else if (bundleId) {
          const bundleEligibility = await client.query(
            `
            SELECT cb.coupon_id 
            FROM coupon_bundles cb 
            WHERE cb.coupon_id = $1 AND cb.bundle_id = $2
            `,
            [couponId, bundleId]
          );

          if (bundleEligibility.rows.length === 0) {
            // If payment already completed, we must honor it (discount was already given)
            if (paymentStatus === "completed") {
              console.warn("recordUsage: Recording usage despite bundle not eligible (payment already completed with discount)", {
                couponId,
                bundleId,
                paymentStatus
              });
              // Continue with recording - don't return error
            } else {
              // For pending payments, we can still reject if not eligible
              return {
                success: false,
                error: "Coupon not applicable for this bundle",
              };
            }
          }
        } else if (bookId) {
          const bookEligibility = await client.query(
            `
            SELECT cbk.coupon_id
            FROM coupon_books cbk
            WHERE cbk.coupon_id = $1 AND cbk.book_id = $2
            `,
            [couponId, bookId]
          );

          if (bookEligibility.rows.length === 0) {
            // If payment already completed, we must honor it (discount was already given)
            if (paymentStatus === "completed") {
              console.warn("recordUsage: Recording usage despite book not eligible (payment already completed with discount)", {
                couponId,
                bookId,
                paymentStatus
              });
              // Continue with recording - don't return error
            } else {
              // For pending payments, we can still reject if not eligible
              return {
                success: false,
                error: "Coupon not applicable for this book",
              };
            }
          }
        }

        // EDGE CASE FIX: Check if transaction_id already exists (idempotency)
        // If same transaction_id exists with same coupon+user+item, allow (retry scenario)
        // If different, reject (data integrity)
        if (transactionId) {
          const existingTransactionCheck = await client.query(
            `
            SELECT id, coupon_id, user_id, course_id, bundle_id, book_id, payment_status
            FROM coupon_usage
            WHERE transaction_id = $1
            `,
            [transactionId]
          );

          if (existingTransactionCheck.rows.length > 0) {
            const existing = existingTransactionCheck.rows[0];
            // Check if it's the same coupon+user+item (idempotency - OK)
            if (existing.coupon_id === couponId &&
                existing.user_id === userId &&
                ((courseId && existing.course_id === courseId) || (bundleId && existing.bundle_id === bundleId) || (bookId && existing.book_id === bookId))) {
              // Same transaction - idempotency, return existing record
              console.log('recordUsage: Transaction already recorded (idempotency):', {
                transactionId,
                existingId: existing.id,
                existingStatus: existing.payment_status
              });
              
              // If existing is 'pending' and we're trying to record 'pending', that's OK (retry)
              // If existing is 'completed' and we're trying to record 'pending', that's weird but allow
              // If existing is 'pending' and we're trying to record 'completed', update it
              if (existing.payment_status === 'pending' && paymentStatus === 'completed') {
                // Update to completed
                const updateResult = await client.query(
                  `UPDATE coupon_usage SET payment_status = $1 WHERE id = $2 RETURNING id`,
                  ['completed', existing.id]
                );
                return {
                  success: true,
                  data: {
                    usageId: existing.id,
                    couponId,
                    newUsageCount: null, // Don't increment again
                    usageLimit: coupon.usage_limit,
                    recordedAt: currentTime,
                    updated: true
                  },
                  message: "Coupon usage status updated (idempotency)",
                };
              }
              
              // Otherwise, return existing record
              return {
                success: true,
                data: {
                  usageId: existing.id,
                  couponId,
                  newUsageCount: null, // Don't increment again
                  usageLimit: coupon.usage_limit,
                  recordedAt: currentTime,
                  alreadyExists: true
                },
                message: "Coupon usage already recorded (idempotency)",
              };
            } else {
              // Different coupon/user/item - data integrity issue
              return {
                success: false,
                error: "Transaction ID already exists with different coupon/user/item combination",
              };
            }
          }
        }
        
        // Record usage with proper validation (support bundle_id/book_id and transaction_id)
        const usageResult = await client.query(
          `
          INSERT INTO coupon_usage (
            coupon_id, user_id, course_id, bundle_id, book_id, original_price,
            discount_amount, final_price, used_at, payment_status, transaction_id,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
          `,
          [
            couponId,
            userId,
            courseId || null,
            bundleId || null,
            bookId || null,
            originalPrice,
            discountAmount,
            finalPrice,
            currentTime,
            paymentStatus,
            transactionId || null,
            JSON.stringify({ recorded_at: currentTime }),
          ]
        );

        // Increment usage count atomically (requirement 9.1)
        const updateResult = await client.query(
          `
          UPDATE coupons 
          SET usage_count = usage_count + 1, updated_at = $1
          WHERE id = $2
          RETURNING usage_count, usage_limit
          `,
          [currentTime, couponId]
        );

        committedUsageId = usageResult.rows[0].id;
        return {
          success: true,
          data: {
            usageId: usageResult.rows[0].id,
            couponId,
            newUsageCount: updateResult.rows[0].usage_count,
            usageLimit: updateResult.rows[0].usage_limit,
            recordedAt: currentTime
          },
          message: "Coupon usage recorded successfully",
        };
      }, { begin: "BEGIN ISOLATION LEVEL READ COMMITTED" });

      if (committedUsageId !== null) {
        // Log successful coupon usage
        CouponAuditLogger.logCouponUsage(
          couponId,
          "unknown", // coupon code not available in this context
          courseId,
          { ...priceData, paymentStatus },
          { id: userId, type: "user" }
        );

        // LINK CLICK TO PURCHASE
        // Link click tracking to purchase completion when payment succeeds
        if (paymentStatus === 'completed' && transactionId) {
          try {
            const couponUsageId = committedUsageId;
            const linkResult = await this.clicks.linkClickToPurchase(
              couponId,
              userId,
              courseId,
              bundleId,
              couponUsageId,
              transactionId,
              bookId
            );
          
            if (linkResult.success && linkResult.data.linked) {
              console.log('recordUsage: Click linked to purchase', {
                clickId: linkResult.data.clickId,
                couponUsageId,
                transactionId
              });
            }
          } catch (linkError) {
            // Don't fail the main operation if click linking fails
            logger.error('recordUsage: Failed to link click to purchase (non-critical):', linkError);
          }
        }
      }

      return result;
    } catch (error) {
      logger.error("Error recording coupon usage:", error);

      // Log error in coupon usage recording
      CouponAuditLogger.logCouponUsage(
        couponId,
        "unknown",
        courseId,
        priceData,
        { id: userId, type: "user" },
        "error",
        error.message
      );

      return {
        success: false,
        error: "Failed to record coupon usage due to system error",
      };
    }
  };

  // coupon_id of the usage row(s) recorded for a payment transaction at initiation.
  getUsageCouponIds = async (transactionId) => {
    return this.query(
      `SELECT coupon_id FROM coupon_usage WHERE transaction_id = $1`,
      [transactionId]
    );
  };

  /**
   * Update coupon usage payment status (e.g., from 'pending' to 'completed')
   * This is called from IPN after payment succeeds
   * @param {string} transactionId - Transaction ID
   * @param {string} paymentStatus - New payment status ('pending', 'completed', 'failed')
   * @returns {Object} Result object with success status
   */
  updateCouponUsageStatus = async (transactionId, paymentStatus) => {
    try {
      if (!transactionId || !paymentStatus) {
        return {
          success: false,
          error: "Transaction ID and payment status are required",
        };
      }

      // Validate payment status
      const validStatuses = ['pending', 'completed', 'failed'];
      if (!validStatuses.includes(paymentStatus)) {
        return {
          success: false,
          error: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}`,
        };
      }

      // Update coupon usage status
      const result = await this.query(
        `
        UPDATE coupon_usage 
        SET payment_status = $1
        WHERE transaction_id = $2 AND payment_status != $1
        RETURNING id, coupon_id, user_id, course_id, bundle_id, payment_status
        `,
        [paymentStatus, transactionId]
      );

      if (result.success && result.data.length > 0) {
        console.log('Coupon usage status updated:', {
          transactionId,
          newStatus: paymentStatus,
          updatedCount: result.data.length
        });

        return {
          success: true,
          data: result.data,
          message: `Coupon usage status updated to ${paymentStatus}`,
        };
      } else if (result.success && result.data.length === 0) {
        // EDGE CASE FIX: Check if record exists but already has target status (idempotency)
        // OR if record doesn't exist at all (should log warning)
        const checkResult = await this.query(
          `SELECT id, payment_status FROM coupon_usage WHERE transaction_id = $1`,
          [transactionId]
        );
        
        if (checkResult.success && checkResult.data.length > 0) {
          // Record exists - check current status
          const currentStatus = checkResult.data[0].payment_status;
          if (currentStatus === paymentStatus) {
            // Record exists and already has target status (idempotency - OK)
            console.log('Coupon usage status already updated (idempotency):', {
              transactionId,
              currentStatus,
              requestedStatus: paymentStatus
            });
            return {
              success: true,
              data: checkResult.data,
              message: `Coupon usage status already ${paymentStatus} (idempotency)`,
            };
          } else {
            // CRITICAL FIX: Record exists but has DIFFERENT status (race condition scenario)
            // This can happen if another process modified the status between UPDATE and SELECT
            // Log warning and return appropriate response
            console.warn('IPN: Attempted to update coupon usage status but record has different status:', {
              transactionId,
              currentStatus,
              requestedStatus: paymentStatus,
              note: 'This may indicate a race condition or concurrent status update'
            });
            return {
              success: true,
              data: checkResult.data,
              message: `Coupon usage record found with status '${currentStatus}' (requested '${paymentStatus}'). Status may have been updated by another process.`,
            };
          }
        } else {
          // EDGE CASE: Record doesn't exist - log warning
          console.warn('IPN: Attempted to update coupon usage status but record not found:', {
            transactionId,
            paymentStatus,
            note: 'This may indicate coupon was not recorded during payment initiation'
          });
          return {
            success: true,
            data: [],
            message: "No coupon usage record found for this transaction",
          };
        }
      }

      return {
        success: false,
        error: "Failed to update coupon usage status",
      };
    } catch (error) {
      logger.error("Error updating coupon usage status:", error);
      return {
        success: false,
        error: "Failed to update coupon usage status due to system error",
      };
    }
  };

  /**
   * Store coupon data for payment tracking (separate from SSLCommerz value_d)
   * This allows us to track coupon data without modifying SSLCommerz parameters
   * @param {string} transactionId - Payment transaction ID
   * @param {Object} couponData - Coupon data object
   * @param {number} userId - User ID
   * @param {number} itemId - Course ID or Bundle ID
   * @param {string} itemType - 'COURSE' or 'BUNDLE'
   * @param {number} originalPrice - Original price
   * @param {number} discountAmount - Discount amount
   * @param {number} finalPrice - Final price after discount
   * @returns {Object} Result object
   */
  storePaymentCouponData = async (
    transactionId,
    couponData,
    userId,
    itemId,
    itemType,
    originalPrice,
    discountAmount,
    finalPrice
  ) => {
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresAt = currentTime + (24 * 60 * 60); // 24 hours expiry

      const result = await this.query(
        `
        INSERT INTO payment_coupon_tracking (
          transaction_id, coupon_id, coupon_code, user_id, item_id, item_type,
          original_price, discount_amount, final_price, created_at, expires_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (transaction_id) DO UPDATE SET
          coupon_id = EXCLUDED.coupon_id,
          coupon_code = EXCLUDED.coupon_code,
          original_price = EXCLUDED.original_price,
          discount_amount = EXCLUDED.discount_amount,
          final_price = EXCLUDED.final_price,
          expires_at = EXCLUDED.expires_at
        RETURNING *
        `,
        [
          transactionId,
          couponData.id,
          couponData.code,
          userId,
          itemId,
          itemType,
          originalPrice,
          discountAmount,
          finalPrice,
          currentTime,
          expiresAt,
          JSON.stringify(couponData.metadata || {})
        ]
      );

      if (result.success) {
        return {
          success: true,
          data: result.data[0]
        };
      }

      return result;
    } catch (error) {
      logger.error("Error storing payment coupon data:", error);
      return {
        success: false,
        error: "Failed to store payment coupon data"
      };
    }
  };

  /**
   * Retrieve coupon data by transaction ID
   * @param {string} transactionId - Payment transaction ID
   * @returns {Object} Result object with coupon data
   */
  getPaymentCouponData = async (transactionId) => {
    try {
      const currentTime = Math.floor(Date.now() / 1000);

      // First try to get unused tracking data
      let result = await this.query(
        `
        SELECT * FROM payment_coupon_tracking
        WHERE transaction_id = $1
        AND expires_at > $2
        AND is_used = FALSE
        `,
        [transactionId, currentTime]
      );

      // If not found, try to get used data (for retry IPN calls)
      // This allows us to verify coupon was already recorded
      if (!result.success || result.data.length === 0) {
        result = await this.query(
          `
          SELECT * FROM payment_coupon_tracking
          WHERE transaction_id = $1
          AND expires_at > $2
          `,
          [transactionId, currentTime]
        );
        
        if (result.success && result.data.length > 0) {
          // Data exists but is already marked as used
          return {
            success: true,
            data: result.data[0],
            alreadyUsed: true
          };
        }
      }

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: result.data[0],
          alreadyUsed: false
        };
      }

      return {
        success: false,
        error: "Coupon tracking data not found or expired"
      };
    } catch (error) {
      logger.error("Error retrieving payment coupon data:", error);
      return {
        success: false,
        error: "Failed to retrieve payment coupon data"
      };
    }
  };

  /**
   * Mark payment coupon tracking as used after IPN processing
   * @param {string} transactionId - Payment transaction ID
   * @returns {Object} Result object
   */
  markPaymentCouponUsed = async (transactionId) => {
    try {
      const result = await this.query(
        `
        UPDATE payment_coupon_tracking
        SET is_used = TRUE
        WHERE transaction_id = $1
        RETURNING *
        `,
        [transactionId]
      );

      if (result.success) {
        return {
          success: true,
          data: result.data[0]
        };
      }

      return result;
    } catch (error) {
      logger.error("Error marking payment coupon as used:", error);
      return {
        success: false,
        error: "Failed to mark payment coupon as used"
      };
    }
  };
}

module.exports = { CouponUsageService };
