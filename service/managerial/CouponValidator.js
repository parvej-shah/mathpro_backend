/**
 * CouponValidator - Comprehensive input validation for coupon operations
 * Implements requirements 7.4, 7.5, 9.1, 9.2, 9.3, 9.4
 */
class CouponValidator {
  /**
   * Normalize input data to handle both snake_case and camelCase
   * @param {Object} data - Input data
   * @returns {Object} Normalized data with camelCase keys (preserves both for compatibility)
   */
  static normalizeInput(data) {
    if (!data || typeof data !== "object") {
      return data;
    }

    const normalized = { ...data };

    // Map snake_case to camelCase (frontend sends snake_case)
    // Keep both versions for maximum compatibility
    if (data.discount_value !== undefined) {
      normalized.discountValue = data.discount_value;
      normalized.discount_value = data.discount_value; // Keep original too
    }
    if (data.discount_type !== undefined) {
      normalized.discountType = data.discount_type;
      normalized.discount_type = data.discount_type; // Keep original too
    }
    if (data.start_time !== undefined) {
      normalized.startTime = data.start_time;
      normalized.start_time = data.start_time; // Keep original too
    }
    if (data.end_time !== undefined) {
      normalized.endTime = data.end_time;
      normalized.end_time = data.end_time; // Keep original too
    }
    if (data.usage_limit !== undefined) {
      normalized.usageLimit = data.usage_limit;
      normalized.usage_limit = data.usage_limit; // Keep original too
    }
    if (data.created_by !== undefined) {
      normalized.createdBy = data.created_by;
      normalized.created_by = data.created_by; // Keep original too
    }

    return normalized;
  }

  /**
   * Validate coupon creation data
   * @param {Object} couponData - Coupon data to validate
   * @returns {Object} Validation result with sanitized data
   */
  static validateCreate(couponData) {
    const errors = [];
    const sanitizedData = {};

    // Normalize input to handle both snake_case and camelCase
    const normalized = this.normalizeInput(couponData);

    // Validate name (required)
    if (!normalized.name || typeof normalized.name !== "string") {
      errors.push("Name is required and must be a string");
    } else if (normalized.name.trim().length < 3) {
      errors.push("Name must be at least 3 characters long");
    } else if (normalized.name.length > 255) {
      errors.push("Name cannot exceed 255 characters");
    } else {
      sanitizedData.name = this.sanitizeString(normalized.name.trim());
    }

    // Validate description (optional)
    if (normalized.description !== undefined) {
      if (typeof normalized.description === "string") {
        if (normalized.description.length > 1000) {
          errors.push("Description cannot exceed 1000 characters");
        } else {
          sanitizedData.description = this.sanitizeString(
            normalized.description.trim()
          );
        }
      } else {
        errors.push("Description must be a string");
      }
    }

    // Validate coupon code (required)
    if (!normalized.code) {
      errors.push("Coupon code is required");
    } else {
      const codeValidation = this.validateCouponCode(normalized.code);
      if (!codeValidation.valid) {
        errors.push(codeValidation.error);
      } else {
        sanitizedData.code = codeValidation.code;
      }
    }

    // Validate discount type and value (required)
    // Accept both discount_type/discountType and discount_value/discountValue
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

    // Validate usage limit (optional)
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

    // Validate start and end times (required)
    // Accept both start_time/startTime and end_time/endTime
    const startTime = normalized.startTime !== undefined 
      ? normalized.startTime 
      : normalized.start_time;
    const endTime = normalized.endTime !== undefined 
      ? normalized.endTime 
      : normalized.end_time;

    if (startTime === undefined || startTime === null || startTime === "" ||
        endTime === undefined || endTime === null || endTime === "") {
      errors.push("Start time and end time are required");
    } else {
      const dateValidation = this.validateDateRange(startTime, endTime);
      if (!dateValidation.valid) {
        errors.push(dateValidation.error);
      } else {
        sanitizedData.startTime = parseInt(startTime);
        sanitizedData.endTime = parseInt(endTime);
      }
    }

    // Validate status (optional)
    if (normalized.status !== undefined) {
      const validStatuses = ["active", "inactive", "expired"];
      if (!validStatuses.includes(normalized.status)) {
        errors.push("Status must be one of: active, inactive, expired");
      } else {
        sanitizedData.status = normalized.status;
      }
    }

    // Validate metadata (optional)
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
  }

  /**
   * Validate coupon update data
   * @param {Object} updateData - Update data to validate
   * @returns {Object} Validation result with sanitized data
   */
  static validateUpdate(updateData) {
    const errors = [];
    const sanitizedData = {};

    // Normalize input to handle both snake_case and camelCase
    const normalized = this.normalizeInput(updateData);

    // Validate name (optional for updates)
    if (normalized.name !== undefined) {
      if (!normalized.name || typeof normalized.name !== "string") {
        errors.push("Name must be a non-empty string");
      } else if (normalized.name.trim().length < 3) {
        errors.push("Name must be at least 3 characters long");
      } else if (normalized.name.length > 255) {
        errors.push("Name cannot exceed 255 characters");
      } else {
        sanitizedData.name = this.sanitizeString(normalized.name.trim());
      }
    }

    // Validate description (optional)
    if (normalized.description !== undefined) {
      if (typeof normalized.description === "string") {
        if (normalized.description.length > 1000) {
          errors.push("Description cannot exceed 1000 characters");
        } else {
          sanitizedData.description = this.sanitizeString(
            normalized.description.trim()
          );
        }
      } else {
        errors.push("Description must be a string");
      }
    }

    // Validate discount type and value (optional for updates)
    // Accept both discount_type/discountType and discount_value/discountValue
    const hasDiscountType = normalized.discountType !== undefined || normalized.discount_type !== undefined;
    const hasDiscountValue = normalized.discountValue !== undefined || normalized.discount_value !== undefined;

    if (hasDiscountType || hasDiscountValue) {
      const discountType = normalized.discountType || normalized.discount_type || "fixed";
      const discountValue = normalized.discountValue !== undefined 
        ? normalized.discountValue 
        : normalized.discount_value;

      if (discountValue !== undefined) {
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
    }

    // Validate usage limit (optional)
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

    // Validate end time (optional for updates)
    const endTime = normalized.endTime !== undefined 
      ? normalized.endTime 
      : normalized.end_time;
    
    if (endTime !== undefined) {
      const currentTime = Math.floor(Date.now() / 1000);
      const time = parseInt(endTime);

      if (isNaN(time) || time <= currentTime) {
        errors.push("End time must be a valid future timestamp");
      } else {
        sanitizedData.endTime = time;
      }
    }

    // Validate status (optional)
    if (normalized.status !== undefined) {
      const validStatuses = ["active", "inactive", "expired"];
      if (!validStatuses.includes(normalized.status)) {
        errors.push("Status must be one of: active, inactive, expired");
      } else {
        sanitizedData.status = normalized.status;
      }
    }

    // Validate metadata (optional)
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
  }

  /**
   * Validate coupon code format and security
   * @param {string} code - Coupon code to validate
   * @returns {Object} Validation result
   * 
   * NOTE: As of v2.2.0, coupon codes support flexible naming with special characters
   * while still applying the core security checks below.
   */
  static validateCouponCode(code) {
    if (!code || typeof code !== "string") {
      return {
        valid: false,
        error: "Coupon code is required",
      };
    }

    // Trim whitespace but preserve original case and special characters
    const trimmedCode = code.trim();

    // Check length (1-50 characters)
    if (trimmedCode.length < 1 || trimmedCode.length > 50) {
      return {
        valid: false,
        error: "Coupon code must be between 1 and 50 characters",
      };
    }

    // Prevent only dangerous patterns for security (XSS, SQL injection)
    // Allow all other characters including special characters like: . ! @ # $ % ^ * ( ) [ ] { } | \ / ? + = ~ ` etc.
    const dangerousPatterns = [
      /[<>'"&]/, // XSS patterns - prevent < > ' " &
      /[;\\]/, // SQL injection patterns - prevent ; and \
      /^\s*$/, // Only whitespace
      /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/, // Control characters (except tab, newline, carriage return)
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmedCode)) {
        return {
          valid: false,
          error: "Coupon code contains invalid characters",
        };
      }
    }

    // Return original code (preserving case and special characters)
    // Examples of valid codes: "PRO.2024", "SAVE-20%", "NEW_USER!", "CODE#123", "TEST@2024"
    return {
      valid: true,
      code: trimmedCode, // Preserve original case and special characters
    };
  }

  /**
   * Validate date range for coupon validity
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Object} Validation result
   */
  static validateDateRange(startTime, endTime) {
    if (!startTime || !endTime) {
      return {
        valid: false,
        error: "Start time and end time are required",
      };
    }

    const start = parseInt(startTime);
    const end = parseInt(endTime);

    if (isNaN(start) || isNaN(end)) {
      return {
        valid: false,
        error: "Start time and end time must be valid timestamps",
      };
    }

    if (end <= start) {
      return {
        valid: false,
        error: "End time must be after start time",
      };
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (end <= currentTime) {
      return {
        valid: false,
        error: "End time must be in the future",
      };
    }

    // Reasonable limits - prevent dates too far in the future (10 years)
    const maxFutureTime = currentTime + 10 * 365 * 24 * 60 * 60;
    if (end > maxFutureTime) {
      return {
        valid: false,
        error: "End time cannot be more than 10 years in the future",
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Validate discount value based on type
   * @param {string} discountType - 'fixed' or 'percentage'
   * @param {number} discountValue - Discount value
   * @returns {Object} Validation result
   */
  static validateDiscountValue(discountType, discountValue) {
    if (!discountType || !["fixed", "percentage"].includes(discountType)) {
      return {
        valid: false,
        error: 'Discount type must be either "fixed" or "percentage"',
      };
    }

    const value = parseFloat(discountValue);
    if (isNaN(value) || value <= 0) {
      return {
        valid: false,
        error: "Discount value must be greater than 0",
      };
    }

    // Check for reasonable limits
    if (discountType === "percentage") {
      if (value > 100) {
        return {
          valid: false,
          error: "Percentage discount cannot exceed 100%",
        };
      }
      if (value < 0.01) {
        return {
          valid: false,
          error: "Percentage discount must be at least 0.01%",
        };
      }
    } else if (discountType === "fixed") {
      // Reasonable upper limit for fixed discounts
      if (value > 100000) {
        return {
          valid: false,
          error: "Fixed discount amount is too large (max: 100,000)",
        };
      }
      if (value < 0.01) {
        return {
          valid: false,
          error: "Fixed discount must be at least 0.01",
        };
      }
    }

    return {
      valid: true,
    };
  }

  /**
   * Validate metadata with size limits and XSS prevention
   * @param {Object} metadata - Metadata object
   * @returns {Object} Validation result with sanitized metadata
   */
  static validateMetadata(metadata) {
    if (!metadata) {
      return {
        valid: true,
        metadata: {},
      };
    }

    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      return {
        valid: false,
        error: "Metadata must be an object",
      };
    }

    // Check size limit (1KB as per requirement 7.4)
    const metadataString = JSON.stringify(metadata);
    if (metadataString.length > 1024) {
      return {
        valid: false,
        error: "Metadata size exceeds 1KB limit",
      };
    }

    // Sanitize metadata to prevent XSS
    const sanitizedMetadata = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof key === "string" && key.length <= 100) {
        // Basic sanitization - remove potentially dangerous characters
        const sanitizedKey = this.sanitizeString(key);
        if (typeof value === "string" && value.length <= 500) {
          sanitizedMetadata[sanitizedKey] = this.sanitizeString(value);
        } else if (typeof value === "number" || typeof value === "boolean") {
          sanitizedMetadata[sanitizedKey] = value;
        } else if (value === null) {
          sanitizedMetadata[sanitizedKey] = null;
        }
        // Skip other types (arrays, objects, etc.)
      }
    }

    return {
      valid: true,
      metadata: sanitizedMetadata,
    };
  }

  /**
   * Validate authorization for coupon operations
   * @param {string} operation - Operation type ('create', 'update', 'delete', 'view', 'validate')
   * @param {Object} user - User object from JWT
   * @param {Object} resource - Resource being accessed (optional)
   * @returns {Object} Authorization result
   */
  static validateAuthorization(operation, user, resource = null) {
    if (!user || !user.type) {
      return {
        authorized: false,
        error: "Authentication required",
      };
    }

    const { managerialAccountTypes } = require("../../util/constants");

    // Admin operations (create, update, delete, view all)
    const adminOperations = ["create", "update", "delete", "list", "analytics"];
    if (adminOperations.includes(operation)) {
      if (
        user.type === managerialAccountTypes.admin ||
        user.type === managerialAccountTypes.moderator
      ) {
        return {
          authorized: true,
        };
      } else {
        return {
          authorized: false,
          error: "Admin privileges required for this operation",
        };
      }
    }

    // User operations (validate, apply)
    const userOperations = ["validate", "apply"];
    if (userOperations.includes(operation)) {
      if (user.type === managerialAccountTypes.regular) {
        return {
          authorized: true,
        };
      } else {
        return {
          authorized: false,
          error: "User account required for this operation",
        };
      }
    }

    // View specific coupon (can be accessed by both admin and user)
    if (operation === "view") {
      return {
        authorized: true,
      };
    }

    return {
      authorized: false,
      error: "Unknown operation",
    };
  }

  /**
   * Sanitize string input to prevent XSS
   * @param {string} input - Input string
   * @returns {string} Sanitized string
   */
  static sanitizeString(input) {
    if (typeof input !== "string") {
      return "";
    }

    // Remove potentially dangerous characters for XSS prevention
    return input.replace(/[<>'"&]/g, "");
  }

  /**
   * Validate course IDs array
   * @param {Array} courseIds - Array of course IDs
   * @returns {Object} Validation result
   */
  static validateCourseIds(courseIds) {
    if (!Array.isArray(courseIds)) {
      return {
        valid: false,
        error: "Course IDs must be an array",
      };
    }

    if (courseIds.length === 0) {
      return {
        valid: false,
        error: "At least one course ID is required",
      };
    }

    if (courseIds.length > 100) {
      return {
        valid: false,
        error: "Cannot associate more than 100 courses at once",
      };
    }

    const validIds = [];
    for (const id of courseIds) {
      const courseId = parseInt(id);
      if (isNaN(courseId) || courseId <= 0) {
        return {
          valid: false,
          error: "All course IDs must be positive integers",
        };
      }
      validIds.push(courseId);
    }

    // Remove duplicates
    const uniqueIds = [...new Set(validIds)];

    return {
      valid: true,
      courseIds: uniqueIds,
    };
  }
}

module.exports = CouponValidator;
