// Validating a coupon for a course, bundle or book and applying it to the price.
// Part of CouponService (service/managerial/coupon.js), which callers use.
const { Service } = require("../../base");
const CouponValidator = require("../CouponValidator");
const CouponAuditLogger = require("../CouponAuditLogger");
const logger = require('../../../util/logger');
const { byKey } = require("../../../util/itemTypes");

class CouponRedemptionService extends Service {
  constructor() {
    super();
  }

  /**
   * Validate a coupon code for a specific course and user (legacy method - uses comprehensive validation)
   * @param {string} code - Coupon code
   * @param {number} courseId - Course ID
   * @param {number} userId - User ID (optional)
   * @param {Object} requestDetails - Request details for audit logging
   * @returns {Object} Validation result with coupon details if valid
   */
  validateCoupon = async (
    code,
    courseId,
    userId = null,
    requestDetails = {}
  ) => {
    const result = await this.validateCouponForItem(code, "course", courseId, userId, {
      notFoundError: "Invalid coupon code",
      failureError: "Failed to validate coupon eligibility",
    });

    // Log validation attempt
    const user = {
      id: userId || "anonymous",
      type: userId ? "user" : "anonymous",
    };
    const logResult = result.valid ? "success" : "failure";
    const error = result.valid ? null : result.error;

    CouponAuditLogger.logCouponValidation(
      code,
      courseId,
      user,
      logResult,
      error,
      requestDetails
    );

    return result;
  };

  /**
   * Calculate discount amount for a coupon and course price
   * @param {Object} coupon - Coupon object
   * @param {number} originalPrice - Original course price
   * @returns {Object} Price calculation result
   */
  calculateDiscount = (coupon, originalPrice) => {
    try {
      let discountAmount = 0;

      if (coupon.discountType === "percentage") {
        discountAmount = (originalPrice * coupon.discountValue) / 100;
      } else if (coupon.discountType === "fixed") {
        discountAmount = Math.min(coupon.discountValue, originalPrice);
      }

      const finalPrice = Math.max(0, originalPrice - discountAmount);

      return {
        success: true,
        originalPrice,
        discountAmount,
        finalPrice,
        discountPercentage:
          originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0,
      };
    } catch (error) {
      logger.error("Error calculating discount:", error);
      return {
        success: false,
        error: "Failed to calculate discount",
      };
    }
  };

  getItemConfig = (itemType) => {
    const type = byKey(itemType);
    if (!type) return null;
    return {
      itemLabel: type.key,
      itemKey: type.idColumn,
      linkTable: type.linkTable,
      linkKey: type.idColumn,
      itemTable: type.itemTable,
    };
  };

  getCouponByCode = async (code, notFoundError = "Invalid coupon code") => {
    const codeValidation = CouponValidator.validateCouponCode(code);
    if (!codeValidation.valid) {
      return codeValidation;
    }

    const couponResult = await this.query(
      `
      SELECT c.*
      FROM coupons c
      WHERE c.code = $1 AND c.status = 'active'
      `,
      [codeValidation.code]
    );

    if (!couponResult.success || couponResult.data.length === 0) {
      return {
        valid: false,
        error: notFoundError,
      };
    }

    return {
      valid: true,
      coupon: couponResult.data[0],
      normalizedCode: codeValidation.code,
    };
  };

  formatValidatedCoupon = (coupon) => {
    return {
      id: coupon.id,
      name: coupon.name,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      description: coupon.description,
      usage_limit: coupon.usage_limit,
      usage_count: coupon.usage_count,
      start_time: coupon.start_time,
      end_time: coupon.end_time,
      status: coupon.status,
      created_at: coupon.created_at,
      updated_at: coupon.updated_at,
      metadata: coupon.metadata,
    };
  };

  getItemPrice = async (itemType, itemId) => {
    const itemConfig = this.getItemConfig(itemType);
    if (!itemConfig) {
      return {
        success: false,
        error: "Invalid item type",
      };
    }

    const result = await this.query(
      `
      SELECT price
      FROM ${itemConfig.itemTable}
      WHERE id = $1
      `,
      [itemId]
    );

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: `${itemConfig.itemLabel.charAt(0).toUpperCase() + itemConfig.itemLabel.slice(1)} not found`,
      };
    }

    const price = parseFloat(result.data[0].price);
    if (Number.isNaN(price) || price < 0) {
      return {
        success: false,
        error: `Invalid ${itemConfig.itemLabel} price`,
      };
    }

    return {
      success: true,
      data: price,
    };
  };

  checkItemEligibility = async (couponId, itemType, itemId) => {
    try {
      const itemConfig = this.getItemConfig(itemType);
      if (!itemConfig) {
        return {
          valid: false,
          error: "Invalid item type",
        };
      }

      const result = await this.query(
        `
        SELECT coupon_id
        FROM ${itemConfig.linkTable}
        WHERE coupon_id = $1 AND ${itemConfig.linkKey} = $2
        `,
        [couponId, itemId]
      );

      if (!result.success || result.data.length === 0) {
        return {
          valid: false,
          error: `Coupon not applicable for this ${itemConfig.itemLabel}`,
        };
      }

      return {
        valid: true,
      };
    } catch (error) {
      logger.error(`Error checking ${itemType} eligibility:`, error);
      return {
        valid: false,
        error: `Failed to check ${itemType} eligibility`,
      };
    }
  };

  checkUserItemEligibility = async (
    couponId,
    userId,
    itemType,
    itemId,
    options = {}
  ) => {
    try {
      const itemConfig = this.getItemConfig(itemType);
      if (!itemConfig) {
        return {
          valid: false,
          error: "Invalid item type",
        };
      }

      const whereConditions = [
        "coupon_id = $1",
        "user_id = $2",
        `${itemConfig.itemKey} = $3`,
      ];
      const params = [couponId, userId, itemId];

      if (options.completedOnly) {
        whereConditions.push("payment_status = 'completed'");
      }

      const usageCheck = await this.query(
        `
        SELECT id
        FROM coupon_usage
        WHERE ${whereConditions.join(" AND ")}
        `,
        params
      );

      if (usageCheck.success && usageCheck.data.length > 0) {
        return {
          valid: false,
          error: `You have already used this coupon for this ${itemConfig.itemLabel}`,
        };
      }

      return {
        valid: true,
      };
    } catch (error) {
      logger.error(`Error checking user ${itemType} eligibility:`, error);
      return {
        valid: false,
        error: "Failed to check user eligibility",
      };
    }
  };

  validateCouponForItem = async (
    code,
    itemType,
    itemId,
    userId = null,
    options = {}
  ) => {
    try {
      const itemConfig = this.getItemConfig(itemType);
      if (!itemConfig || !code || !itemId) {
        return {
          valid: false,
          error: `Coupon code and ${itemConfig ? itemConfig.itemLabel : "item"} ID are required`,
        };
      }

      const couponLookup = await this.getCouponByCode(
        code,
        options.notFoundError || "Invalid coupon code"
      );
      if (!couponLookup.valid) {
        return couponLookup;
      }

      const coupon = couponLookup.coupon;

      const expiryCheck = this.checkCouponExpiry(coupon);
      if (!expiryCheck.valid) {
        if (options.expiryError) {
          return {
            valid: false,
            error: options.expiryError(coupon, expiryCheck.error),
          };
        }
        return expiryCheck;
      }

      const usageLimitCheck = this.checkUsageLimit(coupon);
      if (!usageLimitCheck.valid) {
        return {
          valid: false,
          error: options.usageLimitError || usageLimitCheck.error,
        };
      }

      const itemEligibilityCheck = await this.checkItemEligibility(
        coupon.id,
        itemType,
        itemId
      );
      if (!itemEligibilityCheck.valid) {
        if (options.itemEligibilityError) {
          return {
            valid: false,
            error: options.itemEligibilityError,
          };
        }
        return itemEligibilityCheck;
      }

      if (userId) {
        const userEligibilityCheck = await this.checkUserItemEligibility(
          coupon.id,
          userId,
          itemType,
          itemId,
          {
            completedOnly: options.completedOnly === true,
          }
        );
        if (!userEligibilityCheck.valid) {
          return userEligibilityCheck;
        }
      }

      return {
        valid: true,
        coupon: this.formatValidatedCoupon(coupon),
      };
    } catch (error) {
      logger.error(`Error validating coupon for ${itemType}:`, error);
      return {
        valid: false,
        error: options.failureError || "Failed to validate coupon",
      };
    }
  };

  getActiveCouponsForItem = async (itemType, itemId, options = {}) => {
    try {
      const itemConfig = this.getItemConfig(itemType);
      if (!itemConfig || !itemId) {
        return {
          success: false,
          error: `${itemConfig ? itemConfig.itemLabel : "Item"} ID is required`,
        };
      }

      const currentTime = Math.floor(Date.now() / 1000);

      const endTimeOperator = options.includeEndTime === true ? ">=" : ">";

      const result = await this.query(
        `
        SELECT
          c.id,
          c.name,
          c.description,
          c.discount_type,
          c.discount_value,
          c.usage_limit,
          c.usage_count,
          c.start_time,
          c.end_time
        FROM coupons c
        INNER JOIN ${itemConfig.linkTable} ci ON c.id = ci.coupon_id
        WHERE ci.${itemConfig.linkKey} = $1
          AND c.status = 'active'
          AND c.start_time <= $2
          AND c.end_time ${endTimeOperator} $2
          AND (c.usage_limit IS NULL OR c.usage_count < c.usage_limit)
        ORDER BY c.discount_value DESC, c.created_at DESC
        `,
        [itemId, currentTime]
      );

      if (!result.success) {
        return {
          success: false,
          error: `Failed to retrieve active coupons for ${itemConfig.itemLabel}`,
        };
      }

      return {
        success: true,
        data: result.data,
        totalCoupons: result.data.length,
      };
    } catch (error) {
      logger.error(`Error getting active coupons for ${itemType}:`, error);
      return {
        success: false,
        error: `Failed to retrieve active coupons for ${itemType}`,
      };
    }
  };

  formatPublicCouponPreview = (coupon, basePrice) => {
    const numericBasePrice = parseFloat(basePrice || 0);
    const numericDiscountValue = parseFloat(coupon.discount_value || 0);

    return {
      id: coupon.id,
      name: coupon.name,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      description: coupon.description,
      potential_savings:
        coupon.discount_type === "percentage"
          ? (numericBasePrice * numericDiscountValue) / 100
          : Math.min(numericDiscountValue, numericBasePrice),
    };
  };

  getCoursePrice = async (courseId) => {
    return this.getItemPrice("course", courseId);
  };

  getBundlePrice = async (bundleId) => {
    return this.getItemPrice("bundle", bundleId);
  };

  getBookPrice = async (bookId) => {
    return this.getItemPrice("book", bookId);
  };

  /**
   * Apply coupon to an item purchase (validate and calculate price)
   * @param {Function} validate - item-specific validator (code, itemId, userId) => validation result
   * @param {Function} getPrice - item-specific price getter (itemId) => price result
   * @param {string} code - Coupon code
   * @param {number} itemId - Course/bundle/book ID
   * @param {number} userId - User ID
   * @param {string} errorLabel - label used in the console.error message
   * @returns {Object} Application result with price details
   */
  applyCouponToPriceForItem = async (validate, getPrice, code, itemId, userId, errorLabel) => {
    try {
      const validation = await validate(code, itemId, userId);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const priceResult = await getPrice(itemId);
      if (!priceResult.success) {
        return priceResult;
      }

      // Calculate discount using the authoritative backend price
      const priceCalculation = this.calculateDiscount(
        validation.coupon,
        priceResult.data
      );

      if (!priceCalculation.success) {
        return priceCalculation;
      }

      return {
        success: true,
        data: {
          coupon: validation.coupon,
          original_price: priceCalculation.originalPrice,
          discount_amount: priceCalculation.discountAmount,
          final_price: priceCalculation.finalPrice
        }
      };
    } catch (error) {
      logger.error(`Error applying coupon${errorLabel}:`, error);
      return {
        success: false,
        error: "Failed to apply coupon",
      };
    }
  };

  /**
   * Apply coupon to a course purchase (validate and calculate price)
   * @param {string} code - Coupon code
   * @param {number} courseId - Course ID
   * @param {number} userId - User ID
   * @returns {Object} Application result with price details
   */
  applyCouponToPrice = async (code, courseId, userId) => {
    return this.applyCouponToPriceForItem(
      this.validateCoupon,
      this.getCoursePrice,
      code,
      courseId,
      userId,
      ""
    );
  };

  /**
   * Apply coupon to a bundle purchase (validate and calculate price)
   * @param {string} code - Coupon code
   * @param {number} bundleId - Bundle ID
   * @param {number} userId - User ID
   * @returns {Object} Application result with price details
   */
  applyCouponToPriceForBundle = async (code, bundleId, userId) => {
    return this.applyCouponToPriceForItem(
      this.validateCouponForBundle,
      this.getBundlePrice,
      code,
      bundleId,
      userId,
      " for bundle"
    );
  };

  /**
   * Apply coupon to a standalone book purchase (validate and calculate price)
   * @param {string} code - Coupon code
   * @param {number} bookId - Book ID
   * @param {number} userId - User ID
   * @returns {Object} Application result with price details
   */
  applyCouponToPriceForBook = async (code, bookId, userId) => {
    return this.applyCouponToPriceForItem(
      this.validateCouponForBook,
      this.getBookPrice,
      code,
      bookId,
      userId,
      " for book"
    );
  };

  /**
   * Check if coupon has expired
   * @param {Object} coupon - Coupon object
   * @returns {Object} Validation result
   */
  checkCouponExpiry = (coupon) => {
    const currentTime = Math.floor(Date.now() / 1000);

    if (currentTime < coupon.start_time) {
      return {
        valid: false,
        error: "Coupon is not yet active",
      };
    }

    if (currentTime > coupon.end_time) {
      return {
        valid: false,
        error: "Coupon has expired",
      };
    }

    return {
      valid: true,
    };
  };

  /**
   * Check if coupon usage limit has been reached
   * @param {Object} coupon - Coupon object
   * @returns {Object} Validation result
   */
  checkUsageLimit = (coupon) => {
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return {
        valid: false,
        error: "Coupon usage limit exceeded",
      };
    }

    return {
      valid: true,
    };
  };

  /**
   * Check if a coupon is applicable to a specific course
   * @param {number} couponId - Coupon ID
   * @param {number} courseId - Course ID
   * @returns {Object} Result object with applicability status
   */
  isCouponApplicableToCourse = async (couponId, courseId) => {
    try {
      if (!couponId || !courseId) {
        return {
          success: false,
          error: "Coupon ID and course ID are required",
        };
      }

      const result = await this.query(
        `
        SELECT cc.id, c.title as course_title, co.name as coupon_name
        FROM coupon_courses cc
        JOIN course c ON cc.course_id = c.id
        JOIN coupons co ON cc.coupon_id = co.id
        WHERE cc.coupon_id = $1 AND cc.course_id = $2 AND co.status = 'active'
      `,
        [couponId, courseId]
      );

      if (result.success) {
        const isApplicable = result.data.length > 0;
        return {
          success: true,
          applicable: isApplicable,
          data: isApplicable ? result.data[0] : null,
        };
      }

      return {
        success: false,
        error: "Failed to check coupon applicability",
      };
    } catch (error) {
      logger.error("Error checking coupon applicability:", error);
      return {
        success: false,
        error: "Failed to check coupon applicability",
      };
    }
  };

  /**
   * Get all active coupons applicable to a specific course
   * @param {number} courseId - Course ID
   * @returns {Object} Result object with applicable coupons
   */
  getActiveCouponsForCourse = async (courseId) => {
    return this.getActiveCouponsForItem("course", courseId);
  };

  /**
   * Get active coupons for a bundle
   * @param {number} bundleId - Bundle ID
   * @returns {Object} Result object with active coupons
   */
  getActiveCouponsForBundle = async (bundleId) => {
    return this.getActiveCouponsForItem("bundle", bundleId, {
      includeEndTime: true,
    });
  };

  /**
   * Validate coupon for bundle purchase
   * @param {string} couponCode - Coupon code
   * @param {number} bundleId - Bundle ID
   * @param {number} userId - User ID
   * @returns {Object} Validation result
   */
  validateCouponForBundle = async (couponCode, bundleId, userId) => {
    return this.validateCouponForItem(couponCode, "bundle", bundleId, userId, {
      notFoundError: "Coupon not found",
      usageLimitError: "Coupon usage limit reached",
      itemEligibilityError: "Coupon does not apply to this bundle",
      completedOnly: true,
      expiryError: (_coupon, baseError) =>
        baseError === "Coupon is not yet active"
          ? "Coupon has expired or not yet started"
          : "Coupon has expired or not yet started",
      failureError: "Failed to validate coupon",
    });
  };

  /**
   * Validate coupon for a standalone book purchase
   * @param {string} couponCode - Coupon code
   * @param {number} bookId - Book ID
   * @param {number} userId - User ID
   * @returns {Object} Validation result
   */
  validateCouponForBook = async (couponCode, bookId, userId) => {
    return this.validateCouponForItem(couponCode, "book", bookId, userId, {
      notFoundError: "Coupon not found",
      usageLimitError: "Coupon usage limit reached",
      itemEligibilityError: "Coupon does not apply to this book",
      completedOnly: true,
      expiryError: (_coupon, baseError) =>
        baseError === "Coupon is not yet active"
          ? "Coupon has expired or not yet started"
          : "Coupon has expired or not yet started",
      failureError: "Failed to validate coupon",
    });
  };
}

module.exports = { CouponRedemptionService };
