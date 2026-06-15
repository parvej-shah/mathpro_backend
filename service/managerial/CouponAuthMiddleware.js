const CouponValidator = require("./CouponValidator");
const CouponAuditLogger = require("./CouponAuditLogger");

/**
 * Authorization middleware for coupon operations
 * Implements requirements 7.2, 7.4, 9.1
 */
class CouponAuthMiddleware {
  /**
   * Middleware to validate admin authorization for coupon management operations
   * @param {string} operation - Operation type ('create', 'update', 'delete', 'list', 'analytics')
   * @returns {Function} Express middleware function
   */
  static requireAdmin(operation) {
    return (req, res, next) => {
      try {
        // Extract user from request (set by authenticateAdmin middleware)
        const user = {
          id: req.body.user_id,
          type: req.body.user_type,
        };

        // Validate authorization using CouponValidator
        const authResult = CouponValidator.validateAuthorization(
          operation,
          user
        );

        if (!authResult.authorized) {
          // Log authorization failure
          CouponAuditLogger.logAuthorizationFailure(
            operation,
            user,
            {
              ip: req.ip,
              userAgent: req.get("User-Agent"),
              endpoint: req.originalUrl,
              method: req.method,
            },
            authResult.error
          );

          return res.status(403).json({
            success: false,
            error:
              authResult.error || "Insufficient privileges for this operation",
          });
        }

        // Add user info to request for use in controllers
        req.couponUser = user;
        next();
      } catch (error) {
        console.error("Coupon authorization error:", error);
        return res.status(500).json({
          success: false,
          error: "Authorization validation failed",
        });
      }
    };
  }

  /**
   * Middleware to validate user authorization for coupon application operations
   * @param {string} operation - Operation type ('validate', 'apply')
   * @returns {Function} Express middleware function
   */
  static requireUser(operation) {
    return (req, res, next) => {
      try {
        // Extract user from request (set by authenticateUser middleware)
        const user = {
          id: req.body.user_id || req.user?.id,
          type: req.user?.type,
        };

        // Validate authorization using CouponValidator
        const authResult = CouponValidator.validateAuthorization(
          operation,
          user
        );

        if (!authResult.authorized) {
          // Log authorization failure
          CouponAuditLogger.logAuthorizationFailure(
            operation,
            user,
            {
              ip: req.ip,
              userAgent: req.get("User-Agent"),
              endpoint: req.originalUrl,
              method: req.method,
            },
            authResult.error
          );

          return res.status(403).json({
            success: false,
            error:
              authResult.error || "User account required for this operation",
          });
        }

        // Add user info to request for use in controllers
        req.couponUser = user;
        next();
      } catch (error) {
        console.error("Coupon user authorization error:", error);
        return res.status(500).json({
          success: false,
          error: "Authorization validation failed",
        });
      }
    };
  }

  /**
   * Middleware to validate input data for coupon operations
   * @param {string} validationType - Type of validation ('create', 'update')
   * @returns {Function} Express middleware function
   */
  static validateInput(validationType) {
    return (req, res, next) => {
      try {
        let validation;

        if (validationType === "create") {
          validation = CouponValidator.validateCreate(req.body);
        } else if (validationType === "update") {
          validation = CouponValidator.validateUpdate(req.body);
        } else {
          return res.status(400).json({
            success: false,
            error: "Invalid validation type",
          });
        }

        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: "Validation failed",
            details: validation.errors,
          });
        }

        // Add validated data to request
        req.validatedData = validation.data;
        next();
      } catch (error) {
        console.error("Coupon input validation error:", error);
        return res.status(500).json({
          success: false,
          error: "Input validation failed",
        });
      }
    };
  }

  /**
   * Middleware to validate coupon code format
   * @returns {Function} Express middleware function
   */
  static validateCouponCode() {
    return (req, res, next) => {
      try {
        const { code } = req.body;

        if (!code) {
          return res.status(400).json({
            success: false,
            error: "Coupon code is required",
          });
        }

        const validation = CouponValidator.validateCouponCode(code);

        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: validation.error,
          });
        }

        // Add validated code to request
        req.validatedCode = validation.code;
        next();
      } catch (error) {
        console.error("Coupon code validation error:", error);
        return res.status(500).json({
          success: false,
          error: "Coupon code validation failed",
        });
      }
    };
  }

  /**
   * Middleware to validate course IDs for coupon association
   * @returns {Function} Express middleware function
   */
  static validateCourseIds() {
    return (req, res, next) => {
      try {
        const { courseIds } = req.body;

        if (!courseIds) {
          return res.status(400).json({
            success: false,
            error: "Course IDs are required",
          });
        }

        const validation = CouponValidator.validateCourseIds(courseIds);

        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: validation.error,
          });
        }

        // Add validated course IDs to request
        req.validatedCourseIds = validation.courseIds;
        next();
      } catch (error) {
        console.error("Course IDs validation error:", error);
        return res.status(500).json({
          success: false,
          error: "Course IDs validation failed",
        });
      }
    };
  }

  /**
   * Rate limiting middleware for coupon validation to prevent abuse
   * @param {number} maxAttempts - Maximum attempts per time window (default: 10)
   * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   * @returns {Function} Express middleware function
   */
  static rateLimitValidation(maxAttempts = 10, windowMs = 60000) {
    const attempts = new Map();

    return (req, res, next) => {
      try {
        const clientId = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        // Clean up old entries
        for (const [key, data] of attempts.entries()) {
          if (now - data.firstAttempt > windowMs) {
            attempts.delete(key);
          }
        }

        // Check current client attempts
        const clientAttempts = attempts.get(clientId);

        if (!clientAttempts) {
          attempts.set(clientId, {
            count: 1,
            firstAttempt: now,
          });
        } else {
          if (now - clientAttempts.firstAttempt > windowMs) {
            // Reset window
            attempts.set(clientId, {
              count: 1,
              firstAttempt: now,
            });
          } else {
            clientAttempts.count++;

            if (clientAttempts.count > maxAttempts) {
              // Log rate limit exceeded
              CouponAuditLogger.logRateLimitExceeded(
                { id: "anonymous", type: "unknown" },
                {
                  ip: req.ip,
                  userAgent: req.get("User-Agent"),
                  endpoint: req.originalUrl,
                },
                clientAttempts.count
              );

              return res.status(429).json({
                success: false,
                error:
                  "Too many coupon validation attempts. Please try again later.",
              });
            }
          }
        }

        next();
      } catch (error) {
        console.error("Rate limiting error:", error);
        // Don't block on rate limiting errors, just log and continue
        next();
      }
    };
  }
}

module.exports = CouponAuthMiddleware;
