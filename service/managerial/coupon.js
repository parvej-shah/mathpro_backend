const { Service } = require("../base");
const CouponValidator = require("./CouponValidator");
const CouponAuditLogger = require("./CouponAuditLogger");

class CouponService extends Service {
  constructor() {
    super();
  }

  /**
   * Create a new coupon
   * @param {Object} couponData - Coupon data object
   * @param {number} createdBy - ID of the admin creating the coupon
   * @returns {Object} Result object with success status and data
   */
  createCoupon = async (couponData, createdBy) => {
    try {
      // Use comprehensive input validation from CouponValidator
      const validation = CouponValidator.validateCreate(couponData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(", "),
        };
      }

      const validatedData = validation.data;
      const currentTime = Math.floor(Date.now() / 1000);

      // Use INSERT ON CONFLICT to prevent race conditions in coupon creation (requirement 9.3)
      const result = await this.query(
        `
        INSERT INTO coupons (
          name, description, code, discount_type, discount_value,
          usage_limit, usage_count, start_time, end_time, status,
          created_by, created_at, updated_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (code) DO NOTHING
        RETURNING *
        `,
        [
          validatedData.name,
          validatedData.description || null,
          validatedData.code,
          validatedData.discountType,
          validatedData.discountValue,
          validatedData.usageLimit || null,
          0, // initial usage_count
          validatedData.startTime,
          validatedData.endTime,
          validatedData.status || "active",
          createdBy,
          currentTime,
          currentTime,
          JSON.stringify(validatedData.metadata || {}),
        ]
      );

      // Check if insertion was successful or if there was a conflict
      if (result.success && result.data.length === 0) {
        // Log duplicate coupon code attempt
        CouponAuditLogger.logCouponCreation(
          validatedData,
          { id: createdBy, type: "admin" },
          "failure",
          "Coupon code already exists"
        );

        return {
          success: false,
          error: "Coupon code already exists",
        };
      }

      if (result.success) {
        // Log successful coupon creation
        CouponAuditLogger.logCouponCreation(result.data[0], {
          id: createdBy,
          type: "admin",
        });

        return {
          success: true,
          data: result.data[0],
          message: "Coupon created successfully",
        };
      }

      // Log failed coupon creation
      CouponAuditLogger.logCouponCreation(
        validatedData,
        { id: createdBy, type: "admin" },
        "failure",
        "Database operation failed"
      );
      return result;
    } catch (error) {
      console.error("Error creating coupon:", error);
      // Log error in coupon creation
      CouponAuditLogger.logCouponCreation(
        couponData,
        { id: createdBy, type: "admin" },
        "error",
        error.message
      );

      return {
        success: false,
        error: "Failed to create coupon",
      };
    }
  };

  /**
   * Get a coupon by ID
   * @param {number} id - Coupon ID
   * @returns {Object} Result object with success status and data
   */
  getCoupon = async (id) => {
    try {
      const result = await this.query(
        `
                SELECT c.*, 
                       ma.name as created_by_name,
                       COALESCE(
                           json_agg(
                               json_build_object(
                                   'course_id', co.id,
                                   'course_title', co.title
                               )
                           ) FILTER (WHERE co.id IS NOT NULL), 
                           '[]'
                       ) as applicable_courses
                FROM coupons c
                LEFT JOIN managerial_auth ma ON c.created_by = ma.id
                LEFT JOIN coupon_courses cc ON c.id = cc.coupon_id
                LEFT JOIN course co ON cc.course_id = co.id
                WHERE c.id = $1 AND c.status != 'deleted'
                GROUP BY c.id, ma.name
            `,
        [id]
      );

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: result.data[0],
        };
      }

      return {
        success: false,
        error: "Coupon not found",
      };
    } catch (error) {
      console.error("Error getting coupon:", error);
      return {
        success: false,
        error: "Failed to retrieve coupon",
      };
    }
  };

  /**
   * Update a coupon
   * @param {number} id - Coupon ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Result object with success status and data
   */
  updateCoupon = async (id, updateData) => {
    try {
      // Validate input using CouponValidator
      const validation = CouponValidator.validateUpdate(updateData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(", "),
        };
      }

      const validatedData = validation.data;

      // First check if coupon exists and is not deleted
      const existingCoupon = await this.query(
        "SELECT id, usage_count FROM coupons WHERE id = $1 AND status != $2",
        [id, "deleted"]
      );

      if (!existingCoupon.success || existingCoupon.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Check if trying to reduce usage limit below current usage
      if (
        validatedData.usageLimit !== undefined &&
        validatedData.usageLimit !== null
      ) {
        const currentUsage = existingCoupon.data[0].usage_count;
        if (validatedData.usageLimit < currentUsage) {
          return {
            success: false,
            error: `Cannot set usage limit (${validatedData.usageLimit}) below current usage count (${currentUsage})`,
          };
        }
      }

      const allowedFields = [
        "name",
        "description",
        "discount_type",
        "discount_value",
        "usage_limit",
        "end_time",
        "status",
        "metadata",
      ];

      // Map camelCase field names to snake_case for database columns
      const fieldNameMap = {
        discountType: "discount_type",
        discountValue: "discount_value",
        usageLimit: "usage_limit",
        endTime: "end_time",
      };

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.keys(validatedData).forEach((key) => {
        // Map camelCase to snake_case if needed
        const dbFieldName = fieldNameMap[key] || key;
        
        if (allowedFields.includes(dbFieldName)) {
          updateFields.push(`${dbFieldName} = $${paramIndex}`);
          updateValues.push(
            dbFieldName === "metadata"
              ? JSON.stringify(validatedData[key])
              : validatedData[key]
          );
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return {
          success: false,
          error: "No valid fields to update",
        };
      }

      // Add updated_at timestamp
      updateFields.push(`updated_at = $${paramIndex}`);
      updateValues.push(Math.floor(Date.now() / 1000));
      paramIndex++;

      // Add ID for WHERE clause
      updateValues.push(id);

      const result = await this.query(
        `
                UPDATE coupons 
                SET ${updateFields.join(", ")}
                WHERE id = $${paramIndex}
                RETURNING *
            `,
        updateValues
      );

      if (result.success) {
        // Log successful coupon update
        CouponAuditLogger.logCouponUpdate(id, validatedData, {
          id: "system",
          type: "admin",
        });

        return {
          success: true,
          data: result.data[0],
          message: "Coupon updated successfully",
        };
      }

      // Log failed coupon update
      CouponAuditLogger.logCouponUpdate(
        id,
        validatedData,
        { id: "system", type: "admin" },
        "failure",
        "Database operation failed"
      );
      return result;
    } catch (error) {
      console.error("Error updating coupon:", error);
      // Log error in coupon update
      CouponAuditLogger.logCouponUpdate(
        id,
        updateData,
        { id: "system", type: "admin" },
        "error",
        error.message
      );

      return {
        success: false,
        error: "Failed to update coupon",
      };
    }
  };

  /**
   * Delete a coupon (soft delete if used, hard delete if not used)
   * @param {number} id - Coupon ID
   * @param {number} deletedBy - ID of the admin deleting the coupon
   * @returns {Object} Result object with success status
   */
  deleteCoupon = async (id, deletedBy) => {
    try {
      // Check if coupon exists
      const existingCoupon = await this.query(
        "SELECT id, usage_count FROM coupons WHERE id = $1 AND status != $2",
        [id, "deleted"]
      );

      if (!existingCoupon.success || existingCoupon.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      const coupon = existingCoupon.data[0];

      // Check if coupon has been used
      const usageCheck = await this.query(
        "SELECT COUNT(*) as usage_count FROM coupon_usage WHERE coupon_id = $1",
        [id]
      );

      const hasUsage =
        usageCheck.success && parseInt(usageCheck.data[0].usage_count) > 0;

      if (hasUsage) {
        // Soft delete - mark as deleted but keep data
        const result = await this.query(
          `
                    UPDATE coupons 
                    SET status = 'deleted', updated_at = $1
                    WHERE id = $2
                    RETURNING id, code, name
                `,
          [Math.floor(Date.now() / 1000), id]
        );

        if (result.success) {
          // Log successful soft deletion
          CouponAuditLogger.logCouponDeletion(id, result.data[0].code, "soft", {
            id: deletedBy,
            type: "admin",
          });

          return {
            success: true,
            message:
              "Coupon soft deleted (marked as deleted due to usage history)",
            data: { type: "soft_delete", coupon: result.data[0] },
          };
        }
      } else {
        // Hard delete - remove completely
        // First delete course associations
        await this.query("DELETE FROM coupon_courses WHERE coupon_id = $1", [
          id,
        ]);

        // Then delete the coupon
        const result = await this.query(
          `
                    DELETE FROM coupons WHERE id = $1
                    RETURNING id, code, name
                `,
          [id]
        );

        if (result.success) {
          // Log successful hard deletion
          CouponAuditLogger.logCouponDeletion(id, result.data[0].code, "hard", {
            id: deletedBy,
            type: "admin",
          });

          return {
            success: true,
            message: "Coupon permanently deleted",
            data: { type: "hard_delete", coupon: result.data[0] },
          };
        }
      }

      return {
        success: false,
        error: "Failed to delete coupon",
      };
    } catch (error) {
      console.error("Error deleting coupon:", error);
      // Log error in coupon deletion
      CouponAuditLogger.logCouponDeletion(
        id,
        "unknown",
        "error",
        { id: deletedBy, type: "admin" },
        "error",
        error.message
      );

      return {
        success: false,
        error: "Failed to delete coupon",
      };
    }
  };

  /**
   * List coupons with pagination and filtering
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Object} Result object with success status and data
   */
  listCoupons = async (filters = {}, pagination = {}) => {
    try {
      const { status, discountType, createdBy, search, startDate, endDate } =
        filters;

      const {
        page = 1,
        limit = 10,
        sortBy = "created_at",
        sortOrder = "DESC",
      } = pagination;

      const offset = (page - 1) * limit;
      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      // Base condition to exclude deleted coupons
      whereConditions.push("c.status != 'deleted'");

      // Add filter conditions
      if (status) {
        whereConditions.push(`c.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (discountType) {
        whereConditions.push(`c.discount_type = $${paramIndex}`);
        queryParams.push(discountType);
        paramIndex++;
      }

      if (createdBy) {
        whereConditions.push(`c.created_by = $${paramIndex}`);
        queryParams.push(createdBy);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(
          `(c.name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`
        );
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (startDate) {
        whereConditions.push(`c.created_at >= $${paramIndex}`);
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`c.created_at <= $${paramIndex}`);
        queryParams.push(endDate);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countResult = await this.query(
        `
                SELECT COUNT(*) as total
                FROM coupons c
                ${whereClause}
            `,
        queryParams
      );

      const total = countResult.success
        ? parseInt(countResult.data[0].total)
        : 0;

      // Get paginated results
      // IMPORTANT: Include both usage_count (from coupons table) and total_usage (from coupon_usage join)
      // Frontend may use either, but usage_count is the authoritative source
      const dataResult = await this.query(
        `
                SELECT c.*, 
                       ma.name as created_by_name,
                       c.usage_count,
                       COUNT(cu.id) as total_usage_from_table
                FROM coupons c
                LEFT JOIN managerial_auth ma ON c.created_by = ma.id
                LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
                ${whereClause}
                GROUP BY c.id, ma.name, c.usage_count
                ORDER BY c.${sortBy} ${sortOrder}
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `,
        [...queryParams, limit, offset]
      );

      // Map results to ensure usage_count is always present and use it as primary source
      if (dataResult.success && dataResult.data) {
        dataResult.data = dataResult.data.map(coupon => ({
          ...coupon,
          // Use usage_count from coupons table as primary, fallback to total_usage_from_table if needed
          usage_count: coupon.usage_count || 0,
          total_usage: coupon.usage_count || coupon.total_usage_from_table || 0
        }));
      }

      if (dataResult.success) {
        return {
          success: true,
          data: dataResult.data,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }

      return dataResult;
    } catch (error) {
      console.error("Error listing coupons:", error);
      return {
        success: false,
        error: "Failed to retrieve coupons",
      };
    }
  };

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
    // Use the comprehensive validation method
    const result = await this.validateCouponEligibility(code, courseId, userId);

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
      console.error("Error calculating discount:", error);
      return {
        success: false,
        error: "Failed to calculate discount",
      };
    }
  };

  getItemConfig = (itemType) => {
    if (itemType === "course") {
      return {
        itemLabel: "course",
        itemKey: "course_id",
        linkTable: "coupon_courses",
        linkKey: "course_id",
        itemTable: "course",
      };
    }

    if (itemType === "bundle") {
      return {
        itemLabel: "bundle",
        itemKey: "bundle_id",
        linkTable: "coupon_bundles",
        linkKey: "bundle_id",
        itemTable: "bundle",
      };
    }

    return null;
  };

  getCouponByCode = async (code, notFoundError = "Invalid coupon code") => {
    const codeValidation = this.validateCouponCode(code);
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
      console.error(`Error checking ${itemType} eligibility:`, error);
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
      console.error(`Error checking user ${itemType} eligibility:`, error);
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
      console.error(`Error validating coupon for ${itemType}:`, error);
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
      console.error(`Error getting active coupons for ${itemType}:`, error);
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

  /**
   * Apply coupon to a course purchase (validate and calculate price)
   * @param {string} code - Coupon code
   * @param {number} courseId - Course ID
   * @param {number} userId - User ID
   * @returns {Object} Application result with price details
   */
  applyCouponToPrice = async (code, courseId, userId) => {
    try {
      // Validate coupon first
      const validation = await this.validateCoupon(code, courseId, userId);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const coursePriceResult = await this.getCoursePrice(courseId);
      if (!coursePriceResult.success) {
        return coursePriceResult;
      }

      // Calculate discount using the authoritative backend price
      const priceCalculation = this.calculateDiscount(
        validation.coupon,
        coursePriceResult.data
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
      console.error("Error applying coupon:", error);
      return {
        success: false,
        error: "Failed to apply coupon",
      };
    }
  };

  /**
   * Apply coupon to a bundle purchase (validate and calculate price)
   * @param {string} code - Coupon code
   * @param {number} bundleId - Bundle ID
   * @param {number} userId - User ID
   * @returns {Object} Application result with price details
   */
  applyCouponToPriceForBundle = async (code, bundleId, userId) => {
    try {
      // Validate coupon first
      const validation = await this.validateCouponForBundle(code, bundleId, userId);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const bundlePriceResult = await this.getBundlePrice(bundleId);
      if (!bundlePriceResult.success) {
        return bundlePriceResult;
      }

      // Calculate discount using the authoritative backend price
      const priceCalculation = this.calculateDiscount(
        validation.coupon,
        bundlePriceResult.data
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
      console.error("Error applying coupon for bundle:", error);
      return {
        success: false,
        error: "Failed to apply coupon",
      };
    }
  };

  /**
   * Get a dedicated database client for transactions
   * @returns {Object} Database client
   */
  getClient = async () => {
    const Pool = require("pg").Pool;
    const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_DB,
      password: process.env.DB_PASSWORD || process.env.DB_PASS,
      port: process.env.DB_PORT,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    return await pool.connect();
  };

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
    transactionId = null
  ) => {
    let client = null;

    try {
      // Validate input parameters
      // Either courseId or bundleId must be provided (but not both required)
      if (!couponId || !userId || (!courseId && !bundleId) || !priceData) {
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

      // Get dedicated database client for transaction
      client = await this.getClient();
      const currentTime = Math.floor(Date.now() / 1000);

      // Start transaction with proper isolation level
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");

      try {
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
          await client.query("ROLLBACK");
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
          await client.query("ROLLBACK");
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
                await client.query("ROLLBACK");
                return {
                  success: false,
                  error: "Coupon has expired",
                };
              }
            } else if (currentTime < coupon.start_time) {
              // Coupon not started yet - NO grace period (business rule: coupons only usable after start time)
              await client.query("ROLLBACK");
              return {
                success: false,
                error: "Coupon is not yet active",
              };
            }
          } else {
            // For other statuses (failed), reject expired/not-started coupons
            await client.query("ROLLBACK");
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
              await client.query("ROLLBACK");

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
            await client.query("ROLLBACK");

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
        } else {
          await client.query("ROLLBACK");
          return {
            success: false,
            error: "Either courseId or bundleId must be provided",
          };
        }

        if (existingUsage.rows.length > 0) {
          // Check if there's a completed usage (definite duplicate)
          const completedUsage = existingUsage.rows.find(row => row.payment_status === 'completed');
          if (completedUsage) {
            await client.query("ROLLBACK");
            return {
              success: false,
              error: courseId 
                ? "You have already used this coupon for this course"
                : "You have already used this coupon for this bundle",
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
                await client.query("ROLLBACK");
                return {
                  success: false,
                  error: courseId 
                    ? "You already have a pending payment with this coupon for this course"
                    : "You already have a pending payment with this coupon for this bundle",
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
                await client.query("COMMIT");
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
              await client.query("COMMIT");
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
              await client.query("ROLLBACK");
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
              await client.query("ROLLBACK");
              return {
                success: false,
                error: "Coupon not applicable for this bundle",
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
            SELECT id, coupon_id, user_id, course_id, bundle_id, payment_status 
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
                ((courseId && existing.course_id === courseId) || (bundleId && existing.bundle_id === bundleId))) {
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
                await client.query("COMMIT");
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
              await client.query("COMMIT");
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
              await client.query("ROLLBACK");
              return {
                success: false,
                error: "Transaction ID already exists with different coupon/user/item combination",
              };
            }
          }
        }
        
        // Record usage with proper validation (support bundle_id and transaction_id)
        const usageResult = await client.query(
          `
          INSERT INTO coupon_usage (
            coupon_id, user_id, course_id, bundle_id, original_price,
            discount_amount, final_price, used_at, payment_status, transaction_id,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
          `,
          [
            couponId,
            userId,
            courseId || null,
            bundleId || null,
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

        // Commit transaction
        await client.query("COMMIT");

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
            const couponUsageId = usageResult.rows[0].id;
            const linkResult = await this.linkClickToPurchase(
              couponId,
              userId,
              courseId,
              bundleId,
              couponUsageId,
              transactionId
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
            console.error('recordUsage: Failed to link click to purchase (non-critical):', linkError);
          }
        }

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
      } catch (transactionError) {
        // Rollback transaction on any error (requirement 9.4)
        await client.query("ROLLBACK");
        console.error("Transaction error in recordUsage:", transactionError);
        throw transactionError;
      }
    } catch (error) {
      console.error("Error recording coupon usage:", error);

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
    } finally {
      // Always release the client connection (requirement 9.4)
      if (client) {
        client.release();
      }
    }
  };

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
      console.error("Error tracking coupon click:", error);
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
  linkClickToPurchase = async (couponId, userId, courseId, bundleId, couponUsageId, transactionId) => {
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
      } else {
        selectQuery += ` AND course_id IS NULL AND bundle_id IS NULL`;
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
      console.error("Error linking click to purchase:", error);
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

      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const offset = (page - 1) * limit;

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
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          },
        };
      }

      return dataResult;
    } catch (error) {
      console.error("Error getting coupon clicks:", error);
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
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const offset = (page - 1) * limit;

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
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          },
        };
      }

      return dataResult;
    } catch (error) {
      console.error("Error getting all coupon clicks:", error);
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
      console.error("Error getting click details:", error);
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
      console.error("Error getting coupon conversion stats:", error);
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
      console.error("Error getting coupon click analytics:", error);
      return {
        success: false,
        error: "Failed to retrieve click analytics",
      };
    }
  };

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
      console.error("Error getting all coupon stats:", error);
      return {
        success: false,
        error: "Failed to retrieve overall stats",
      };
    }
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
      console.error("Error updating coupon usage status:", error);
      return {
        success: false,
        error: "Failed to update coupon usage status due to system error",
      };
    }
  };

  /**
   * Validate coupon code format and business rules with security checks
   * @param {string} code - Coupon code to validate
   * @returns {Object} Validation result
   */
  validateCouponCode = (code) => {
    // Delegate to CouponValidator for consistent validation
    return CouponValidator.validateCouponCode(code);
  };

  /**
   * Validate date range for coupon validity
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Object} Validation result
   */
  validateDateRange = (startTime, endTime) => {
    // Delegate to CouponValidator for consistent validation
    return CouponValidator.validateDateRange(startTime, endTime);
  };

  /**
   * Validate discount value based on type with enhanced checks
   * @param {string} discountType - 'fixed' or 'percentage'
   * @param {number} discountValue - Discount value
   * @returns {Object} Validation result
   */
  validateDiscountValue = (discountType, discountValue) => {
    // Delegate to CouponValidator for consistent validation
    return CouponValidator.validateDiscountValue(discountType, discountValue);
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
   * Check if coupon is applicable to a specific course
   * @param {number} couponId - Coupon ID
   * @param {number} courseId - Course ID
   * @returns {Object} Validation result
   */
  checkCourseEligibility = async (couponId, courseId) => {
    return this.checkItemEligibility(couponId, "course", courseId);
  };

  /**
   * Check if user is eligible to use the coupon
   * @param {number} couponId - Coupon ID
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Object} Validation result
   */
  checkUserEligibility = async (couponId, userId, courseId) => {
    return this.checkUserItemEligibility(couponId, userId, "course", courseId);
  };

  /**
   * Validate metadata input with size limits and sanitization
   * @param {Object} metadata - Metadata object
   * @returns {Object} Validation result
   */
  validateMetadata = (metadata) => {
    // Delegate to CouponValidator for consistent validation
    return CouponValidator.validateMetadata(metadata);
  };

  /**
   * Comprehensive coupon validation with all business rules
   * @param {string} code - Coupon code
   * @param {number} courseId - Course ID
   * @param {number} userId - User ID (optional)
   * @returns {Object} Comprehensive validation result
   */
  validateCouponEligibility = async (code, courseId, userId = null) => {
    return this.validateCouponForItem(code, "course", courseId, userId, {
      notFoundError: "Invalid coupon code",
      failureError: "Failed to validate coupon eligibility",
    });
  };

  /**
   * Add course associations to a coupon
   * @param {number} couponId - Coupon ID
   * @param {Array} courseIds - Array of course IDs to associate
   * @returns {Object} Result object with success status
   */
  addCoursesToCoupon = async (couponId, courseIds) => {
    try {
      if (!couponId || !Array.isArray(courseIds) || courseIds.length === 0) {
        return {
          success: false,
          error: "Coupon ID and course IDs array are required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Validate that all course IDs exist
      const courseCheck = await this.query(
        `SELECT id FROM course WHERE id = ANY($1)`,
        [courseIds]
      );

      if (!courseCheck.success) {
        return {
          success: false,
          error: "Failed to validate course IDs",
        };
      }

      const validCourseIds = courseCheck.data.map((row) => row.id);
      const invalidCourseIds = courseIds.filter(
        (id) => !validCourseIds.includes(parseInt(id))
      );

      if (invalidCourseIds.length > 0) {
        return {
          success: false,
          error: `Invalid course IDs: ${invalidCourseIds.join(", ")}`,
        };
      }

      // Get existing associations to avoid duplicates
      const existingAssociations = await this.query(
        "SELECT course_id FROM coupon_courses WHERE coupon_id = $1",
        [couponId]
      );

      const existingCourseIds = existingAssociations.success
        ? existingAssociations.data.map((row) => row.course_id)
        : [];

      // Filter out already associated courses
      const newCourseIds = courseIds.filter(
        (id) => !existingCourseIds.includes(parseInt(id))
      );

      if (newCourseIds.length === 0) {
        return {
          success: true,
          message: "All courses are already associated with this coupon",
          data: { addedCount: 0, existingCount: courseIds.length },
        };
      }

      // Insert new associations
      const currentTime = Math.floor(Date.now() / 1000);
      const insertValues = newCourseIds
        .map(
          (courseId, index) =>
            `($1, $${index + 2}, $${newCourseIds.length + 2})`
        )
        .join(", ");

      const insertParams = [couponId, ...newCourseIds, currentTime];

      const insertResult = await this.query(
        `
        INSERT INTO coupon_courses (coupon_id, course_id, created_at)
        VALUES ${insertValues}
        RETURNING id, course_id
      `,
        insertParams
      );

      if (insertResult.success) {
        return {
          success: true,
          message: `Successfully associated ${insertResult.data.length} courses with coupon`,
          data: {
            addedCount: insertResult.data.length,
            existingCount: courseIds.length - insertResult.data.length,
            addedCourses: insertResult.data,
          },
        };
      }

      return {
        success: false,
        error: "Failed to create course associations",
      };
    } catch (error) {
      console.error("Error adding courses to coupon:", error);
      return {
        success: false,
        error: "Failed to add courses to coupon",
      };
    }
  };

  /**
   * Remove course associations from a coupon
   * @param {number} couponId - Coupon ID
   * @param {Array} courseIds - Array of course IDs to remove
   * @returns {Object} Result object with success status
   */
  removeCoursesFromCoupon = async (couponId, courseIds) => {
    try {
      if (!couponId || !Array.isArray(courseIds) || courseIds.length === 0) {
        return {
          success: false,
          error: "Coupon ID and course IDs array are required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Remove associations
      const deleteResult = await this.query(
        `
        DELETE FROM coupon_courses 
        WHERE coupon_id = $1 AND course_id = ANY($2)
        RETURNING id, course_id
      `,
        [couponId, courseIds]
      );

      if (deleteResult.success) {
        return {
          success: true,
          message: `Successfully removed ${deleteResult.data.length} course associations`,
          data: {
            removedCount: deleteResult.data.length,
            removedCourses: deleteResult.data,
          },
        };
      }

      return {
        success: false,
        error: "Failed to remove course associations",
      };
    } catch (error) {
      console.error("Error removing courses from coupon:", error);
      return {
        success: false,
        error: "Failed to remove courses from coupon",
      };
    }
  };

  /**
   * Comprehensive input validation for coupon creation/update
   * @param {Object} couponData - Coupon data to validate
   * @param {boolean} isUpdate - Whether this is an update operation
   * @returns {Object} Validation result with sanitized data
   */
  validateCouponInput = (couponData, isUpdate = false) => {
    const errors = [];
    const sanitizedData = {};

    // Normalize input to handle both snake_case and camelCase
    const normalized = CouponValidator.normalizeInput(couponData);

    // Validate name
    if (normalized.name !== undefined) {
      if (!normalized.name || typeof normalized.name !== "string") {
        errors.push("Name is required and must be a string");
      } else if (normalized.name.trim().length < 3) {
        errors.push("Name must be at least 3 characters long");
      } else if (normalized.name.length > 255) {
        errors.push("Name cannot exceed 255 characters");
      } else {
        sanitizedData.name = normalized.name.trim().replace(/[<>'"&]/g, "");
      }
    } else if (!isUpdate) {
      errors.push("Name is required");
    }

    // Validate description
    if (normalized.description !== undefined) {
      if (typeof normalized.description === "string") {
        if (normalized.description.length > 1000) {
          errors.push("Description cannot exceed 1000 characters");
        } else {
          sanitizedData.description = normalized.description
            .trim()
            .replace(/[<>'"&]/g, "");
        }
      } else {
        errors.push("Description must be a string");
      }
    }

    // Validate coupon code
    if (normalized.code !== undefined) {
      const codeValidation = this.validateCouponCode(normalized.code);
      if (!codeValidation.valid) {
        errors.push(codeValidation.error);
      } else {
        sanitizedData.code = codeValidation.code;
      }
    } else if (!isUpdate) {
      errors.push("Coupon code is required");
    }

    // Validate discount type and value
    // Accept both discount_type/discountType and discount_value/discountValue
    const hasDiscountType = normalized.discountType !== undefined || normalized.discount_type !== undefined;
    const hasDiscountValue = normalized.discountValue !== undefined || normalized.discount_value !== undefined;

    if (hasDiscountType || hasDiscountValue) {
      const discountType = normalized.discountType || normalized.discount_type || "fixed";
      const discountValue = normalized.discountValue !== undefined 
        ? normalized.discountValue 
        : normalized.discount_value;

      if (discountValue === undefined || discountValue === null || discountValue === "") {
        errors.push("Discount value is required");
      } else {
        const discountValidation = this.validateDiscountValue(
          discountType,
          discountValue
        );
        if (!discountValidation.valid) {
          errors.push(discountValidation.error);
        } else {
          sanitizedData.discountType = discountType;
          sanitizedData.discountValue = parseFloat(discountValue);
        }
      }
    } else if (!isUpdate) {
      errors.push("Discount type and value are required");
    }

    // Validate usage limit
    const usageLimit = normalized.usageLimit !== undefined 
      ? normalized.usageLimit 
      : normalized.usage_limit;
    
    if (usageLimit !== undefined) {
      if (usageLimit !== null) {
        const limit = parseInt(usageLimit);
        if (isNaN(limit) || limit <= 0) {
          errors.push("Usage limit must be a positive integer");
        } else if (limit > 1000000) {
          errors.push("Usage limit cannot exceed 1,000,000");
        } else {
          sanitizedData.usageLimit = limit;
        }
      } else {
        sanitizedData.usageLimit = null; // Unlimited usage
      }
    }

    // Validate start and end times
    // Accept both start_time/startTime and end_time/endTime
    const startTime = normalized.startTime !== undefined 
      ? normalized.startTime 
      : normalized.start_time;
    const endTime = normalized.endTime !== undefined 
      ? normalized.endTime 
      : normalized.end_time;

    if (startTime !== undefined || endTime !== undefined) {
      if (startTime === undefined || startTime === null || startTime === "" ||
          endTime === undefined || endTime === null || endTime === "") {
        if (!isUpdate) {
          errors.push("Start time and end time are required");
        }
      } else {
        const dateValidation = this.validateDateRange(startTime, endTime);
        if (!dateValidation.valid) {
          errors.push(dateValidation.error);
        } else {
          sanitizedData.startTime = parseInt(startTime);
          sanitizedData.endTime = parseInt(endTime);
        }
      }
    } else if (!isUpdate) {
      errors.push("Start time and end time are required");
    }

    // Validate status
    if (normalized.status !== undefined) {
      const validStatuses = ["active", "inactive", "expired"];
      if (!validStatuses.includes(normalized.status)) {
        errors.push("Status must be one of: active, inactive, expired");
      } else {
        sanitizedData.status = normalized.status;
      }
    }

    // Validate metadata
    if (normalized.metadata !== undefined) {
      const metadataValidation = this.validateMetadata(normalized.metadata);
      if (!metadataValidation.valid) {
        errors.push(metadataValidation.error);
      } else {
        sanitizedData.metadata = metadataValidation.metadata;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data: sanitizedData,
    };
  };

  /**
   * Get all courses associated with a coupon
   * @param {number} couponId - Coupon ID
   * @returns {Object} Result object with course list
   */
  getCouponCourses = async (couponId) => {
    try {
      if (!couponId) {
        return {
          success: false,
          error: "Coupon ID is required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id, name, code FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Get associated courses
      const coursesResult = await this.query(
        `
        SELECT c.id, c.title, c.price, cc.created_at as associated_at
        FROM coupon_courses cc
        JOIN course c ON cc.course_id = c.id
        WHERE cc.coupon_id = $1
        ORDER BY c.title
      `,
        [couponId]
      );

      if (coursesResult.success) {
        return {
          success: true,
          data: {
            coupon: couponCheck.data[0],
            courses: coursesResult.data,
            totalCourses: coursesResult.data.length,
          },
        };
      }

      return {
        success: false,
        error: "Failed to retrieve associated courses",
      };
    } catch (error) {
      console.error("Error getting coupon courses:", error);
      return {
        success: false,
        error: "Failed to retrieve coupon courses",
      };
    }
  };

  /**
   * Get all available courses that can be associated with coupons
   * @param {number} couponId - Optional coupon ID to exclude already associated courses
   * @returns {Object} Result object with available courses
   */
  getAvailableCourses = async (couponId = null) => {
    try {
      let query = "SELECT id, title, price FROM course ORDER BY title";
      let params = [];

      if (couponId) {
        query = `
          SELECT c.id, c.title, c.price 
          FROM course c
          WHERE c.id NOT IN (
            SELECT cc.course_id 
            FROM coupon_courses cc 
            WHERE cc.coupon_id = $1
          )
          ORDER BY c.title
        `;
        params = [couponId];
      }

      const result = await this.query(query, params);

      if (result.success) {
        return {
          success: true,
          data: result.data,
          totalCourses: result.data.length,
        };
      }

      return {
        success: false,
        error: "Failed to retrieve available courses",
      };
    } catch (error) {
      console.error("Error getting available courses:", error);
      return {
        success: false,
        error: "Failed to retrieve available courses",
      };
    }
  };

  /**
   * Add bundle associations to a coupon
   * @param {number} couponId - Coupon ID
   * @param {Array} bundleIds - Array of bundle IDs to associate
   * @returns {Object} Result object with success status
   */
  addBundlesToCoupon = async (couponId, bundleIds) => {
    try {
      if (!couponId || !Array.isArray(bundleIds) || bundleIds.length === 0) {
        return {
          success: false,
          error: "Coupon ID and bundle IDs array are required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Validate that all bundle IDs exist
      const bundleCheck = await this.query(
        `SELECT id FROM bundle WHERE id = ANY($1)`,
        [bundleIds]
      );

      if (!bundleCheck.success) {
        return {
          success: false,
          error: "Failed to validate bundle IDs",
        };
      }

      const validBundleIds = bundleCheck.data.map((row) => row.id);
      const invalidBundleIds = bundleIds.filter(
        (id) => !validBundleIds.includes(parseInt(id))
      );

      if (invalidBundleIds.length > 0) {
        return {
          success: false,
          error: `Invalid bundle IDs: ${invalidBundleIds.join(", ")}`,
        };
      }

      // Get existing associations to avoid duplicates
      const existingAssociations = await this.query(
        "SELECT bundle_id FROM coupon_bundles WHERE coupon_id = $1",
        [couponId]
      );

      const existingBundleIds = existingAssociations.success
        ? existingAssociations.data.map((row) => row.bundle_id)
        : [];

      // Filter out already associated bundles
      const newBundleIds = bundleIds.filter(
        (id) => !existingBundleIds.includes(parseInt(id))
      );

      if (newBundleIds.length === 0) {
        return {
          success: true,
          message: "All bundles are already associated with this coupon",
          data: { addedCount: 0, existingCount: bundleIds.length },
        };
      }

      // Insert new associations
      const currentTime = Math.floor(Date.now() / 1000);
      const insertValues = newBundleIds
        .map(
          (bundleId, index) =>
            `($1, $${index + 2}, $${newBundleIds.length + 2})`
        )
        .join(", ");

      const insertParams = [couponId, ...newBundleIds, currentTime];

      const insertResult = await this.query(
        `
        INSERT INTO coupon_bundles (coupon_id, bundle_id, created_at)
        VALUES ${insertValues}
        RETURNING id, bundle_id
      `,
        insertParams
      );

      if (insertResult.success) {
        return {
          success: true,
          message: `Successfully associated ${insertResult.data.length} bundles with coupon`,
          data: {
            addedCount: insertResult.data.length,
            existingCount: bundleIds.length - insertResult.data.length,
            addedBundles: insertResult.data,
          },
        };
      }

      return {
        success: false,
        error: "Failed to create bundle associations",
      };
    } catch (error) {
      console.error("Error adding bundles to coupon:", error);
      return {
        success: false,
        error: "Failed to add bundles to coupon",
      };
    }
  };

  /**
   * Remove bundle associations from a coupon
   * @param {number} couponId - Coupon ID
   * @param {Array} bundleIds - Array of bundle IDs to remove
   * @returns {Object} Result object with success status
   */
  removeBundlesFromCoupon = async (couponId, bundleIds) => {
    try {
      if (!couponId || !Array.isArray(bundleIds) || bundleIds.length === 0) {
        return {
          success: false,
          error: "Coupon ID and bundle IDs array are required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Remove associations
      const deleteResult = await this.query(
        `
        DELETE FROM coupon_bundles 
        WHERE coupon_id = $1 AND bundle_id = ANY($2)
        RETURNING id, bundle_id
      `,
        [couponId, bundleIds]
      );

      if (deleteResult.success) {
        return {
          success: true,
          message: `Successfully removed ${deleteResult.data.length} bundle associations`,
          data: {
            removedCount: deleteResult.data.length,
            removedBundles: deleteResult.data,
          },
        };
      }

      return {
        success: false,
        error: "Failed to remove bundle associations",
      };
    } catch (error) {
      console.error("Error removing bundles from coupon:", error);
      return {
        success: false,
        error: "Failed to remove bundles from coupon",
      };
    }
  };

  /**
   * Get bundles associated with a coupon
   * @param {number} couponId - Coupon ID
   * @returns {Object} Result object with bundle data
   */
  getCouponBundles = async (couponId) => {
    try {
      if (!couponId) {
        return {
          success: false,
          error: "Coupon ID is required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Get associated bundles
      const result = await this.query(
        `
        SELECT 
          b.id,
          b.title,
          b.price,
          b.url,
          cb.created_at as associated_at
        FROM coupon_bundles cb
        JOIN bundle b ON cb.bundle_id = b.id
        WHERE cb.coupon_id = $1
        ORDER BY b.title
      `,
        [couponId]
      );

      if (result.success) {
        return {
          success: true,
          data: result.data,
          totalBundles: result.data.length,
        };
      }

      return {
        success: false,
        error: "Failed to retrieve coupon bundles",
      };
    } catch (error) {
      console.error("Error getting coupon bundles:", error);
      return {
        success: false,
        error: "Failed to retrieve coupon bundles",
      };
    }
  };

  /**
   * Get available bundles that can be associated with coupons
   * @param {number} couponId - Optional coupon ID to exclude already associated bundles
   * @returns {Object} Result object with available bundle data
   */
  getAvailableBundles = async (couponId = null) => {
    try {
      let query = "SELECT id, title, price FROM bundle ORDER BY title";
      let params = [];

      if (couponId) {
        query = `
          SELECT b.id, b.title, b.price 
          FROM bundle b
          WHERE b.id NOT IN (
            SELECT cb.bundle_id 
            FROM coupon_bundles cb 
            WHERE cb.coupon_id = $1
          )
          ORDER BY b.title
        `;
        params = [couponId];
      }

      const result = await this.query(query, params);

      if (result.success) {
        return {
          success: true,
          data: result.data,
          totalBundles: result.data.length,
        };
      }

      return {
        success: false,
        error: "Failed to retrieve available bundles",
      };
    } catch (error) {
      console.error("Error getting available bundles:", error);
      return {
        success: false,
        error: "Failed to retrieve available bundles",
      };
    }
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
      console.error("Error checking coupon applicability:", error);
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
      console.error("Error generating coupon usage statistics:", error);
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
      console.error("Error generating revenue impact analytics:", error);
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
      console.error("Error getting top performing coupons:", error);
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
      console.error("Error generating coupon usage report:", error);
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
      console.error("Error storing payment coupon data:", error);
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
      console.error("Error retrieving payment coupon data:", error);
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
      console.error("Error marking payment coupon as used:", error);
      return {
        success: false,
        error: "Failed to mark payment coupon as used"
      };
    }
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

}

module.exports = CouponService;
