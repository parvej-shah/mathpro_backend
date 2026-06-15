const CouponAuditLogger = require("./CouponAuditLogger");

/**
 * CouponSecurityMiddleware - Enhanced security measures for coupon operations
 * Implements requirements 7.1, 7.3, 7.4, 9.5
 */
class CouponSecurityMiddleware {
  /**
   * Comprehensive input sanitization middleware
   * @returns {Function} Express middleware function
   */
  static sanitizeInput() {
    return (req, res, next) => {
      try {
        // Sanitize request body
        if (req.body && typeof req.body === "object") {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === "object") {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === "object") {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        console.error("Input sanitization error:", error);

        // Log security event for sanitization failure
        CouponAuditLogger.logSecurityEvent(
          "input_sanitization_failed",
          {
            error: error.message,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            endpoint: req.originalUrl,
          },
          { id: "system", type: "system" },
          "high"
        );

        return res.status(400).json({
          success: false,
          error: "Invalid input data",
        });
      }
    };
  }

  /**
   * XSS prevention middleware
   * @returns {Function} Express middleware function
   */
  static preventXSS() {
    return (req, res, next) => {
      try {
        // Check for XSS patterns in request data
        const xssPatterns = [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
          /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
          /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
        ];

        const requestData = JSON.stringify({
          body: req.body,
          query: req.query,
          params: req.params,
        });

        for (const pattern of xssPatterns) {
          if (pattern.test(requestData)) {
            // Log XSS attempt
            CouponAuditLogger.logSecurityEvent(
              "xss_attempt_detected",
              {
                pattern: pattern.toString(),
                requestData: requestData.substring(0, 500), // Limit log size
                ip: req.ip,
                userAgent: req.get("User-Agent"),
                endpoint: req.originalUrl,
                method: req.method,
              },
              { id: "anonymous", type: "unknown" },
              "critical"
            );

            return res.status(400).json({
              success: false,
              error: "Invalid input detected",
            });
          }
        }

        next();
      } catch (error) {
        console.error("XSS prevention error:", error);
        next(); // Don't block on XSS prevention errors
      }
    };
  }

  /**
   * SQL injection prevention middleware
   * @returns {Function} Express middleware function
   */
  static preventSQLInjection() {
    return (req, res, next) => {
      try {
        // Check for SQL injection patterns
        const sqlPatterns = [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
          /('|(\\')|(;)|(--)|(\|)|(\*)|(%)|(\+))/gi,
          /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
          /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
        ];

        const requestData = JSON.stringify({
          body: req.body,
          query: req.query,
          params: req.params,
        });

        for (const pattern of sqlPatterns) {
          if (pattern.test(requestData)) {
            // Log SQL injection attempt
            CouponAuditLogger.logSecurityEvent(
              "sql_injection_attempt",
              {
                pattern: pattern.toString(),
                requestData: requestData.substring(0, 500), // Limit log size
                ip: req.ip,
                userAgent: req.get("User-Agent"),
                endpoint: req.originalUrl,
                method: req.method,
              },
              { id: "anonymous", type: "unknown" },
              "critical"
            );

            return res.status(400).json({
              success: false,
              error: "Invalid input detected",
            });
          }
        }

        next();
      } catch (error) {
        console.error("SQL injection prevention error:", error);
        next(); // Don't block on prevention errors
      }
    };
  }

  /**
   * Enhanced rate limiting with progressive penalties
   * @param {Object} options - Rate limiting options
   * @returns {Function} Express middleware function
   */
  static enhancedRateLimit(options = {}) {
    const {
      windowMs = 60000, // 1 minute
      maxAttempts = 10,
      progressivePenalty = true,
      blockDuration = 300000, // 5 minutes
    } = options;

    const attempts = new Map();
    const blocked = new Map();

    return (req, res, next) => {
      try {
        const clientId = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        // Check if client is currently blocked
        const blockInfo = blocked.get(clientId);
        if (blockInfo && now < blockInfo.blockedUntil) {
          CouponAuditLogger.logSecurityEvent(
            "blocked_client_attempt",
            {
              ip: req.ip,
              userAgent: req.get("User-Agent"),
              endpoint: req.originalUrl,
              blockedUntil: new Date(blockInfo.blockedUntil).toISOString(),
              reason: "client_blocked_due_to_abuse",
            },
            { id: "anonymous", type: "unknown" },
            "high"
          );

          return res.status(429).json({
            success: false,
            error: "Access temporarily blocked due to suspicious activity",
          });
        }

        // Clean up expired entries
        for (const [key, data] of attempts.entries()) {
          if (now - data.firstAttempt > windowMs) {
            attempts.delete(key);
          }
        }

        // Clean up expired blocks
        for (const [key, data] of blocked.entries()) {
          if (now > data.blockedUntil) {
            blocked.delete(key);
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
              // Block client if progressive penalty is enabled
              if (progressivePenalty) {
                blocked.set(clientId, {
                  blockedUntil: now + blockDuration,
                  reason: "rate_limit_exceeded",
                });

                CouponAuditLogger.logSecurityEvent(
                  "client_blocked",
                  {
                    ip: req.ip,
                    userAgent: req.get("User-Agent"),
                    endpoint: req.originalUrl,
                    attemptCount: clientAttempts.count,
                    blockDuration: blockDuration,
                    reason: "progressive_penalty_applied",
                  },
                  { id: "anonymous", type: "unknown" },
                  "high"
                );
              }

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
                error: "Too many requests. Please try again later.",
              });
            }
          }
        }

        next();
      } catch (error) {
        console.error("Enhanced rate limiting error:", error);
        next(); // Don't block on rate limiting errors
      }
    };
  }

  /**
   * Suspicious activity detection middleware
   * @returns {Function} Express middleware function
   */
  static detectSuspiciousActivity() {
    const suspiciousPatterns = new Map();

    return (req, res, next) => {
      try {
        const clientId = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowMs = 300000; // 5 minutes

        // Initialize or get client pattern tracking
        if (!suspiciousPatterns.has(clientId)) {
          suspiciousPatterns.set(clientId, {
            requests: [],
            flags: [],
          });
        }

        const clientData = suspiciousPatterns.get(clientId);

        // Clean old requests
        clientData.requests = clientData.requests.filter(
          (req) => now - req.timestamp < windowMs
        );

        // Add current request
        clientData.requests.push({
          timestamp: now,
          endpoint: req.originalUrl,
          method: req.method,
          userAgent: req.get("User-Agent"),
        });

        // Detect suspicious patterns
        const flags = [];

        // Pattern 1: Too many different endpoints in short time
        const uniqueEndpoints = new Set(
          clientData.requests.map((r) => r.endpoint)
        );
        if (uniqueEndpoints.size > 20) {
          flags.push("endpoint_scanning");
        }

        // Pattern 2: Rapid sequential requests
        const recentRequests = clientData.requests.filter(
          (r) => now - r.timestamp < 10000 // Last 10 seconds
        );
        if (recentRequests.length > 50) {
          flags.push("rapid_requests");
        }

        // Pattern 3: Suspicious user agent patterns
        const userAgent = req.get("User-Agent") || "";
        const suspiciousUAPatterns = [
          /bot/i,
          /crawler/i,
          /spider/i,
          /scraper/i,
          /curl/i,
          /wget/i,
          /python/i,
          /java/i,
        ];

        if (suspiciousUAPatterns.some((pattern) => pattern.test(userAgent))) {
          flags.push("suspicious_user_agent");
        }

        // Log suspicious activity if detected
        if (flags.length > 0) {
          CouponAuditLogger.logSuspiciousActivity(
            "automated_behavior_detected",
            {
              flags,
              requestCount: clientData.requests.length,
              uniqueEndpoints: uniqueEndpoints.size,
              recentRequestCount: recentRequests.length,
              ip: req.ip,
              userAgent: req.get("User-Agent"),
              endpoint: req.originalUrl,
              timeWindow: "5_minutes",
            },
            { id: "anonymous", type: "unknown" },
            "medium"
          );

          // Add to client flags
          clientData.flags = [...new Set([...clientData.flags, ...flags])];
        }

        next();
      } catch (error) {
        console.error("Suspicious activity detection error:", error);
        next(); // Don't block on detection errors
      }
    };
  }

  /**
   * Sanitize an object recursively
   * @param {Object} obj - Object to sanitize
   * @returns {Object} Sanitized object
   */
  static sanitizeObject(obj) {
    if (typeof obj !== "object" || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeValue(key);
      sanitized[sanitizedKey] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  /**
   * Sanitize a single value
   * @param {*} value - Value to sanitize
   * @returns {*} Sanitized value
   */
  static sanitizeValue(value) {
    if (typeof value === "string") {
      // Remove potentially dangerous characters
      return value
        .replace(/[<>'"&]/g, "") // XSS prevention
        .replace(/[;\\]/g, "") // SQL injection prevention
        .trim();
    }

    return value;
  }

  /**
   * Security headers middleware
   * @returns {Function} Express middleware function
   */
  static setSecurityHeaders() {
    return (req, res, next) => {
      // Set security headers
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("Content-Security-Policy", "default-src 'self'");

      next();
    };
  }

  /**
   * Request logging middleware for security monitoring
   * @returns {Function} Express middleware function
   */
  static logSecurityRequests() {
    return (req, res, next) => {
      // Log all coupon-related requests for security monitoring
      const requestInfo = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        contentType: req.get("Content-Type"),
        contentLength: req.get("Content-Length"),
        referer: req.get("Referer"),
      };

      // console.log(`[COUPON_SECURITY_REQUEST] ${JSON.stringify(requestInfo)}`);

      next();
    };
  }
}

module.exports = CouponSecurityMiddleware;
