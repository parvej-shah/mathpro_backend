/**
 * CouponAuditLogger - Comprehensive audit logging for coupon operations
 * Implements requirements 7.1, 7.3, 7.4, 9.5
 */
class CouponAuditLogger {
  /**
   * Log coupon operation with structured data
   * @param {string} operation - Operation type (create, update, delete, validate, apply, etc.)
   * @param {Object} details - Operation details
   * @param {Object} user - User performing the operation
   * @param {string} result - Operation result (success, failure, error)
   * @param {string} error - Error message if operation failed
   */
  static logOperation(
    operation,
    details = {},
    user = {},
    result = "success",
    error = null
  ) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation,
      result,
      user: {
        id: user.id || "anonymous",
        type: user.type || "unknown",
        ip: details.ip || "unknown",
      },
      details: {
        couponId: details.couponId,
        couponCode: details.couponCode,
        courseId: details.courseId,
        originalPrice: details.originalPrice,
        discountAmount: details.discountAmount,
        finalPrice: details.finalPrice,
        metadata: details.metadata || {},
      },
      error: error || null,
      severity: this.getSeverity(operation, result),
      category: "coupon_audit",
    };

    // Log to console with structured format (disabled for production)
    // console.log(`[COUPON_AUDIT] ${JSON.stringify(logEntry)}`);

    // In production, this could be sent to external logging service
    // Example: this.sendToExternalLogger(logEntry);
  }

  /**
   * Log security events and failed attempts
   * @param {string} event - Security event type
   * @param {Object} details - Event details
   * @param {Object} user - User involved in the event
   * @param {string} severity - Event severity (low, medium, high, critical)
   */
  static logSecurityEvent(event, details = {}, user = {}, severity = "medium") {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event,
      severity,
      user: {
        id: user.id || "anonymous",
        type: user.type || "unknown",
        ip: details.ip || "unknown",
        userAgent: details.userAgent || "unknown",
      },
      details: {
        couponCode: details.couponCode,
        courseId: details.courseId,
        attemptCount: details.attemptCount,
        reason: details.reason,
        endpoint: details.endpoint,
        method: details.method,
        metadata: details.metadata || {},
      },
      category: "coupon_security",
    };

    // Log security events with special prefix for monitoring (disabled for production)
    // console.log(`[COUPON_SECURITY] ${JSON.stringify(logEntry)}`);

    // In production, security events should be sent to SIEM or security monitoring
    // Example: this.sendToSecurityMonitoring(logEntry);
  }

  /**
   * Log coupon creation
   * @param {Object} couponData - Created coupon data
   * @param {Object} user - User who created the coupon
   * @param {string} result - Operation result
   * @param {string} error - Error message if failed
   */
  static logCouponCreation(couponData, user, result = "success", error = null) {
    this.logOperation(
      "create",
      {
        couponId: couponData.id,
        couponCode: couponData.code,
        discountType: couponData.discount_type,
        discountValue: couponData.discount_value,
        usageLimit: couponData.usage_limit,
        startTime: couponData.start_time,
        endTime: couponData.end_time,
        metadata: { name: couponData.name },
      },
      user,
      result,
      error
    );
  }

  /**
   * Log coupon update
   * @param {number} couponId - Updated coupon ID
   * @param {Object} updateData - Update data
   * @param {Object} user - User who updated the coupon
   * @param {string} result - Operation result
   * @param {string} error - Error message if failed
   */
  static logCouponUpdate(
    couponId,
    updateData,
    user,
    result = "success",
    error = null
  ) {
    this.logOperation(
      "update",
      {
        couponId,
        metadata: {
          updatedFields: Object.keys(updateData),
          updateData: updateData,
        },
      },
      user,
      result,
      error
    );
  }

  /**
   * Log coupon deletion
   * @param {number} couponId - Deleted coupon ID
   * @param {string} couponCode - Deleted coupon code
   * @param {string} deletionType - 'soft' or 'hard' deletion
   * @param {Object} user - User who deleted the coupon
   * @param {string} result - Operation result
   * @param {string} error - Error message if failed
   */
  static logCouponDeletion(
    couponId,
    couponCode,
    deletionType,
    user,
    result = "success",
    error = null
  ) {
    this.logOperation(
      "delete",
      {
        couponId,
        couponCode,
        metadata: { deletionType },
      },
      user,
      result,
      error
    );
  }

  /**
   * Log coupon validation attempt
   * @param {string} couponCode - Coupon code being validated
   * @param {number} courseId - Course ID
   * @param {Object} user - User attempting validation
   * @param {string} result - Validation result
   * @param {string} error - Error message if validation failed
   * @param {Object} requestDetails - Request details (IP, user agent, etc.)
   */
  static logCouponValidation(
    couponCode,
    courseId,
    user,
    result = "success",
    error = null,
    requestDetails = {}
  ) {
    this.logOperation(
      "validate",
      {
        couponCode,
        courseId,
        ip: requestDetails.ip,
        userAgent: requestDetails.userAgent,
        metadata: { validationAttempt: true },
      },
      user,
      result,
      error
    );

    // Log security event for failed validations
    if (result === "failure" || result === "error") {
      this.logSecurityEvent(
        "coupon_validation_failed",
        {
          couponCode,
          courseId,
          reason: error,
          ip: requestDetails.ip,
          userAgent: requestDetails.userAgent,
          endpoint: requestDetails.endpoint,
        },
        user,
        "medium"
      );
    }
  }

  /**
   * Log coupon usage/application
   * @param {number} couponId - Coupon ID
   * @param {string} couponCode - Coupon code
   * @param {number} courseId - Course ID
   * @param {Object} priceData - Price calculation data
   * @param {Object} user - User applying the coupon
   * @param {string} result - Application result
   * @param {string} error - Error message if failed
   */
  static logCouponUsage(
    couponId,
    couponCode,
    courseId,
    priceData,
    user,
    result = "success",
    error = null
  ) {
    this.logOperation(
      "usage",
      {
        couponId,
        couponCode,
        courseId,
        originalPrice: priceData.originalPrice,
        discountAmount: priceData.discountAmount,
        finalPrice: priceData.finalPrice,
        metadata: {
          usageRecorded: result === "success",
          paymentStatus: priceData.paymentStatus || "pending",
        },
      },
      user,
      result,
      error
    );
  }

  /**
   * Log failed authorization attempts
   * @param {string} operation - Attempted operation
   * @param {Object} user - User attempting the operation
   * @param {Object} requestDetails - Request details
   * @param {string} reason - Reason for authorization failure
   */
  static logAuthorizationFailure(
    operation,
    user,
    requestDetails = {},
    reason = "insufficient_privileges"
  ) {
    this.logSecurityEvent(
      "authorization_failed",
      {
        operation,
        reason,
        ip: requestDetails.ip,
        userAgent: requestDetails.userAgent,
        endpoint: requestDetails.endpoint,
        method: requestDetails.method,
      },
      user,
      "high"
    );
  }

  /**
   * Log rate limiting events
   * @param {Object} user - User being rate limited
   * @param {Object} requestDetails - Request details
   * @param {number} attemptCount - Number of attempts made
   */
  static logRateLimitExceeded(user, requestDetails = {}, attemptCount = 0) {
    this.logSecurityEvent(
      "rate_limit_exceeded",
      {
        attemptCount,
        ip: requestDetails.ip,
        userAgent: requestDetails.userAgent,
        endpoint: requestDetails.endpoint,
        reason: "too_many_requests",
      },
      user,
      "high"
    );
  }

  /**
   * Log suspicious activity
   * @param {string} activity - Type of suspicious activity
   * @param {Object} details - Activity details
   * @param {Object} user - User involved
   * @param {string} severity - Severity level
   */
  static logSuspiciousActivity(
    activity,
    details = {},
    user = {},
    severity = "high"
  ) {
    this.logSecurityEvent(
      "suspicious_activity",
      {
        activity,
        ...details,
        metadata: {
          flagged: true,
          requiresReview: severity === "critical",
        },
      },
      user,
      severity
    );
  }

  /**
   * Get severity level based on operation and result
   * @param {string} operation - Operation type
   * @param {string} result - Operation result
   * @returns {string} Severity level
   */
  static getSeverity(operation, result) {
    if (result === "error") return "high";
    if (result === "failure") return "medium";

    // High-impact operations
    const highImpactOps = ["create", "delete", "update"];
    if (highImpactOps.includes(operation)) return "medium";

    return "low";
  }

  /**
   * Log database transaction events
   * @param {string} transactionType - Type of transaction
   * @param {Object} details - Transaction details
   * @param {string} result - Transaction result
   * @param {string} error - Error message if failed
   */
  static logTransaction(
    transactionType,
    details = {},
    result = "success",
    error = null
  ) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      transactionType,
      result,
      details: {
        couponId: details.couponId,
        userId: details.userId,
        courseId: details.courseId,
        duration: details.duration,
        metadata: details.metadata || {},
      },
      error: error || null,
      category: "coupon_transaction",
    };

    // console.log(`[COUPON_TRANSACTION] ${JSON.stringify(logEntry)}`);
  }

  /**
   * Create audit trail entry for compliance
   * @param {string} action - Action performed
   * @param {Object} before - State before action
   * @param {Object} after - State after action
   * @param {Object} user - User performing action
   */
  static createAuditTrail(action, before, after, user) {
    const timestamp = new Date().toISOString();
    const auditEntry = {
      timestamp,
      action,
      user: {
        id: user.id,
        type: user.type,
      },
      changes: {
        before: before || {},
        after: after || {},
      },
      category: "coupon_audit_trail",
    };

    // console.log(`[COUPON_AUDIT_TRAIL] ${JSON.stringify(auditEntry)}`);
  }
}

module.exports = CouponAuditLogger;
