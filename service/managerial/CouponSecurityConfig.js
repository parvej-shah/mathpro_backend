const CouponAuthMiddleware = require("./CouponAuthMiddleware");
const CouponSecurityMiddleware = require("./CouponSecurityMiddleware");

/**
 * CouponSecurityConfig - Centralized security configuration for coupon routes
 * Implements requirements 7.1, 7.3, 7.4, 9.5
 */
class CouponSecurityConfig {
  /**
   * Get security middleware stack for admin coupon operations
   * @param {string} operation - Operation type (create, update, delete, list, analytics)
   * @returns {Array} Array of middleware functions
   */
  static getAdminSecurityStack(operation) {
    return [
      // Security headers
      CouponSecurityMiddleware.setSecurityHeaders(),

      // Request logging for security monitoring
      CouponSecurityMiddleware.logSecurityRequests(),

      // Input sanitization and XSS prevention
      CouponSecurityMiddleware.sanitizeInput(),
      CouponSecurityMiddleware.preventXSS(),
      CouponSecurityMiddleware.preventSQLInjection(),

      // Suspicious activity detection
      CouponSecurityMiddleware.detectSuspiciousActivity(),

      // Rate limiting (more lenient for admin operations)
      CouponSecurityMiddleware.enhancedRateLimit({
        windowMs: 60000, // 1 minute
        maxAttempts: 50, // Higher limit for admin operations
        progressivePenalty: true,
        blockDuration: 300000, // 5 minutes
      }),

      // Authorization (requires admin privileges)
      CouponAuthMiddleware.requireAdmin(operation),
    ];
  }

  /**
   * Get security middleware stack for user coupon operations
   * @param {string} operation - Operation type (validate, apply)
   * @returns {Array} Array of middleware functions
   */
  static getUserSecurityStack(operation) {
    return [
      // Security headers
      CouponSecurityMiddleware.setSecurityHeaders(),

      // Request logging for security monitoring
      CouponSecurityMiddleware.logSecurityRequests(),

      // Input sanitization and XSS prevention
      CouponSecurityMiddleware.sanitizeInput(),
      CouponSecurityMiddleware.preventXSS(),
      CouponSecurityMiddleware.preventSQLInjection(),

      // Suspicious activity detection
      CouponSecurityMiddleware.detectSuspiciousActivity(),

      // Strict rate limiting for validation to prevent abuse
      CouponSecurityMiddleware.enhancedRateLimit({
        windowMs: 60000, // 1 minute
        maxAttempts: 10, // Lower limit for user operations
        progressivePenalty: true,
        blockDuration: 600000, // 10 minutes (longer block for users)
      }),

      // Authorization (requires user account)
      CouponAuthMiddleware.requireUser(operation),
    ];
  }

  /**
   * Get security middleware stack for coupon validation (public endpoint)
   * @returns {Array} Array of middleware functions
   */
  static getValidationSecurityStack() {
    return [
      // Security headers
      CouponSecurityMiddleware.setSecurityHeaders(),

      // Request logging for security monitoring
      CouponSecurityMiddleware.logSecurityRequests(),

      // Input sanitization and XSS prevention
      CouponSecurityMiddleware.sanitizeInput(),
      CouponSecurityMiddleware.preventXSS(),
      CouponSecurityMiddleware.preventSQLInjection(),

      // Suspicious activity detection
      CouponSecurityMiddleware.detectSuspiciousActivity(),

      // Very strict rate limiting for public validation
      CouponSecurityMiddleware.enhancedRateLimit({
        windowMs: 60000, // 1 minute
        maxAttempts: 5, // Very low limit for public access
        progressivePenalty: true,
        blockDuration: 900000, // 15 minutes (longest block)
      }),

      // Coupon code validation
      CouponAuthMiddleware.validateCouponCode(),
    ];
  }

  /**
   * Get input validation middleware for coupon creation
   * @returns {Array} Array of middleware functions
   */
  static getCouponCreationValidation() {
    return [CouponAuthMiddleware.validateInput("create")];
  }

  /**
   * Get input validation middleware for coupon updates
   * @returns {Array} Array of middleware functions
   */
  static getCouponUpdateValidation() {
    return [CouponAuthMiddleware.validateInput("update")];
  }

  /**
   * Get course association validation middleware
   * @returns {Array} Array of middleware functions
   */
  static getCourseAssociationValidation() {
    return [CouponAuthMiddleware.validateCourseIds()];
  }

  /**
   * Get comprehensive security configuration for all coupon endpoints
   * @returns {Object} Security configuration object
   */
  static getFullSecurityConfig() {
    return {
      // Admin endpoints
      admin: {
        create: [
          ...this.getAdminSecurityStack("create"),
          ...this.getCouponCreationValidation(),
        ],
        update: [
          ...this.getAdminSecurityStack("update"),
          ...this.getCouponUpdateValidation(),
        ],
        delete: this.getAdminSecurityStack("delete"),
        list: this.getAdminSecurityStack("list"),
        view: this.getAdminSecurityStack("view"),
        analytics: this.getAdminSecurityStack("analytics"),
        addCourses: [
          ...this.getAdminSecurityStack("update"),
          ...this.getCourseAssociationValidation(),
        ],
        removeCourses: [
          ...this.getAdminSecurityStack("update"),
          ...this.getCourseAssociationValidation(),
        ],
      },

      // User endpoints
      user: {
        validate: this.getUserSecurityStack("validate"),
        apply: this.getUserSecurityStack("apply"),
      },

      // Public endpoints (if any)
      public: {
        validate: this.getValidationSecurityStack(),
      },
    };
  }

  /**
   * Security configuration for different environments
   * @param {string} environment - Environment (development, staging, production)
   * @returns {Object} Environment-specific security config
   */
  static getEnvironmentConfig(environment = "production") {
    const baseConfig = this.getFullSecurityConfig();

    switch (environment) {
      case "development":
        return {
          ...baseConfig,
          // More lenient rate limiting for development
          rateLimiting: {
            windowMs: 60000,
            maxAttempts: 100,
            progressivePenalty: false,
          },
          logging: {
            level: "debug",
            includeRequestBody: true,
          },
        };

      case "staging":
        return {
          ...baseConfig,
          // Moderate rate limiting for staging
          rateLimiting: {
            windowMs: 60000,
            maxAttempts: 50,
            progressivePenalty: true,
            blockDuration: 300000,
          },
          logging: {
            level: "info",
            includeRequestBody: false,
          },
        };

      case "production":
      default:
        return {
          ...baseConfig,
          // Strict rate limiting for production
          rateLimiting: {
            windowMs: 60000,
            maxAttempts: 10,
            progressivePenalty: true,
            blockDuration: 600000,
          },
          logging: {
            level: "warn",
            includeRequestBody: false,
          },
          // Additional production security measures
          additionalSecurity: {
            requireHttps: true,
            enableCSRFProtection: true,
            enableCORS: false,
          },
        };
    }
  }

  /**
   * Get security metrics configuration
   * @returns {Object} Security metrics configuration
   */
  static getSecurityMetrics() {
    return {
      // Metrics to track for security monitoring
      trackingMetrics: [
        "failed_authorization_attempts",
        "rate_limit_violations",
        "xss_attempts",
        "sql_injection_attempts",
        "suspicious_activity_flags",
        "blocked_clients",
        "coupon_validation_failures",
        "coupon_usage_anomalies",
      ],

      // Alert thresholds
      alertThresholds: {
        failed_authorization_per_minute: 10,
        rate_limit_violations_per_hour: 100,
        xss_attempts_per_hour: 5,
        sql_injection_attempts_per_hour: 3,
        suspicious_activity_flags_per_hour: 50,
        blocked_clients_per_hour: 20,
      },

      // Monitoring intervals
      monitoringIntervals: {
        realtime: 60000, // 1 minute
        hourly: 3600000, // 1 hour
        daily: 86400000, // 24 hours
      },
    };
  }
}

module.exports = CouponSecurityConfig;
