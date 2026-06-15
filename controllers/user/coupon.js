const Controller = require("../base").Controller;
const CouponService = require("../../service/managerial/coupon");

const couponService = new CouponService();

class UserCouponController extends Controller {
  constructor() {
    super();
  }

  /**
   * Validate a coupon code for a specific course or bundle
   * POST /user/coupon/validate
   * Body: { coupon_code, course_id OR bundle_id, user_id }
   */
  validateCoupon = async (req, res) => {
    try {
      const { coupon_code, course_id, bundle_id, user_id } = req.body;

      if (!coupon_code) {
        return res.status(400).json({
          success: false,
          error: "Coupon code is required",
        });
      }

      // Must provide either course_id OR bundle_id, but not both
      if (!course_id && !bundle_id) {
        return res.status(400).json({
          success: false,
          error: "Either course_id or bundle_id is required",
        });
      }

      if (course_id && bundle_id) {
        return res.status(400).json({
          success: false,
          error: "Provide either course_id or bundle_id, not both",
        });
      }

      const userId = user_id ? parseInt(user_id) : null;

      // Add request details for audit logging
      const requestDetails = {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        timestamp: Math.floor(Date.now() / 1000),
      };

      let result;
      if (course_id) {
        const courseId = parseInt(course_id);
        if (isNaN(courseId)) {
          return res.status(400).json({
            success: false,
            error: "Valid course ID is required",
          });
        }
        result = await couponService.validateCoupon(
          coupon_code,
          courseId,
          userId,
          requestDetails
        );
      } else {
        // bundle_id provided
        const bundleId = parseInt(bundle_id);
        if (isNaN(bundleId)) {
          return res.status(400).json({
            success: false,
            error: "Valid bundle ID is required",
          });
        }
        result = await couponService.validateCouponForBundle(
          coupon_code,
          bundleId,
          userId
        );
      }

      return res.status(result.valid ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in coupon validation controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Apply a coupon to calculate discounted price for a course or bundle
   * POST /user/coupon/apply
   * Body: { coupon_code, course_id OR bundle_id, user_id, original_price }
   */
  applyCoupon = async (req, res) => {
    try {
      const { coupon_code, course_id, bundle_id, user_id, original_price } = req.body;

      if (!coupon_code || !original_price) {
        return res.status(400).json({
          success: false,
          error: "Coupon code and original price are required",
        });
      }

      // Must provide either course_id OR bundle_id, but not both
      if (!course_id && !bundle_id) {
        return res.status(400).json({
          success: false,
          error: "Either course_id or bundle_id is required",
        });
      }

      if (course_id && bundle_id) {
        return res.status(400).json({
          success: false,
          error: "Provide either course_id or bundle_id, not both",
        });
      }

      const userId = user_id ? parseInt(user_id) : null;
      const price = parseFloat(original_price);

      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          error: "Valid price is required",
        });
      }

      let result;
      let couponId = null;
      
      if (course_id) {
        const courseId = parseInt(course_id);
        if (isNaN(courseId)) {
          return res.status(400).json({
            success: false,
            error: "Valid course ID is required",
          });
        }
        result = await couponService.applyCouponToPrice(
          coupon_code,
          courseId,
          userId,
          price
        );
        
        if (result.success && result.data && result.data.coupon) {
          couponId = result.data.coupon.id;
        }
      } else {
        // bundle_id provided
        const bundleId = parseInt(bundle_id);
        if (isNaN(bundleId)) {
          return res.status(400).json({
            success: false,
            error: "Valid bundle ID is required",
          });
        }
        result = await couponService.applyCouponToPriceForBundle(
          coupon_code,
          bundleId,
          userId,
          price
        );
        
        if (result.success && result.data && result.data.coupon) {
          couponId = result.data.coupon.id;
        }
      }

      // Track coupon click after successful application
      if (result.success && couponId && userId) {
        try {
          const requestDetails = {
            userAgent: req.get('User-Agent') || null,
            metadata: {
              // Store discount information at click time for analytics
              original_price: result.data.original_price,
              discount_amount: result.data.discount_amount,
              final_price: result.data.final_price
            }
          };
          
          if (course_id) {
            await couponService.trackCouponClick(
              couponId,
              userId,
              parseInt(course_id),
              null,
              requestDetails
            );
          } else if (bundle_id) {
            await couponService.trackCouponClick(
              couponId,
              userId,
              null,
              parseInt(bundle_id),
              requestDetails
            );
          }
        } catch (trackError) {
          // Non-critical error - don't fail the request if tracking fails
          console.warn('Failed to track coupon click (non-critical):', trackError);
        }
      }

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in coupon application controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Get active coupons for a specific course
   * GET /user/coupon/course/:course_id
   */
  getActiveCouponsForCourse = async (req, res) => {
    try {
      const courseId = parseInt(req.params.course_id);

      if (!courseId || isNaN(courseId)) {
        return res.status(400).json({
          success: false,
          error: "Valid course ID is required",
        });
      }

      const result = await couponService.getActiveCouponsForCourse(courseId);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in get active coupons controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  /**
   * Check if a coupon is applicable to a specific course
   * GET /user/coupon/check-applicability
   * Query: coupon_id, course_id
   */
  checkCouponApplicability = async (req, res) => {
    try {
      const { coupon_id, course_id } = req.query;

      if (!coupon_id || !course_id) {
        return res.status(400).json({
          success: false,
          error: "Coupon ID and course ID are required",
        });
      }

      const couponId = parseInt(coupon_id);
      const courseId = parseInt(course_id);

      if (isNaN(couponId) || isNaN(courseId)) {
        return res.status(400).json({
          success: false,
          error: "Valid coupon ID and course ID are required",
        });
      }

      const result = await couponService.isCouponApplicableToCourse(
        couponId,
        courseId
      );
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in check coupon applicability controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };
}

module.exports = { UserCouponController };
