// Coupon records: create, read, update, delete, list, and input validation.
// Part of CouponService (service/managerial/coupon.js), which callers use.
const { Service } = require("../../base");
const CouponValidator = require("../CouponValidator");
const CouponAuditLogger = require("../CouponAuditLogger");
const logger = require('../../../util/logger');

class CouponCrudService extends Service {
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
      logger.error("Error creating coupon:", error);
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
      logger.error("Error getting coupon:", error);
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
      logger.error("Error updating coupon:", error);
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
      logger.error("Error deleting coupon:", error);
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

  // Coupon totals per status (deleted coupons excluded), for the analytics dashboard.
  countCouponsByStatus = async () => {
    return this.query(
      `SELECT 
          COUNT(*) as total_coupons,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_coupons,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_coupons,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_coupons
        FROM coupons 
        WHERE status != 'deleted'`
    );
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
      logger.error("Error listing coupons:", error);
      return {
        success: false,
        error: "Failed to retrieve coupons",
      };
    }
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
      const codeValidation = CouponValidator.validateCouponCode(normalized.code);
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
        const discountValidation = CouponValidator.validateDiscountValue(
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
        const dateValidation = CouponValidator.validateDateRange(startTime, endTime);
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
}

module.exports = { CouponCrudService };
