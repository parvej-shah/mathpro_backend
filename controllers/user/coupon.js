const Controller = require("../base").Controller;
const { respond, catchAs } = require('../base');
const CouponService = require("../../service/managerial/coupon");

const couponService = new CouponService();

// Reads `{ coupon_code, course_id | bundle_id | book_id }`. Returns `{ error }` (the 400 message)
// or `{ couponCode, type: "course" | "bundle" | "book", id }`.
const COUPON_TARGETS = [["course_id", "course"], ["bundle_id", "bundle"], ["book_id", "book"]];
const parseCouponRequest = (body) => {
  if (!body.coupon_code) {
    return { error: "Coupon code is required" };
  }
  const given = COUPON_TARGETS.filter(([field]) => body[field]);
  if (given.length === 0) {
    return { error: "Either course_id, bundle_id or book_id is required" };
  }
  if (given.length > 1) {
    return { error: "Provide only one of course_id, bundle_id or book_id" };
  }
  const [field, type] = given[0];
  const id = parseInt(body[field]);
  if (isNaN(id)) {
    return { error: `Valid ${type} ID is required` };
  }
  return { couponCode: body.coupon_code, type, id };
};

class UserCouponController extends Controller {
  constructor() {
    super();
  }

  /**
   * Validate a coupon code for a specific course, bundle, or book
   * POST /user/coupon/validate
   * Body: { coupon_code, course_id OR bundle_id OR book_id }
   */
  validateCoupon = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const target = parseCouponRequest(req.body);
    if (target.error) {
      return res.status(400).json({ success: false, error: target.error });
    }

    const userId = req.body.auth === true ? parseInt(req.body.user_id) : null;

    // Add request details for audit logging
    const requestDetails = {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: Math.floor(Date.now() / 1000),
    };

    let result;
    if (target.type === "course") {
      result = await couponService.validateCoupon(target.couponCode, target.id, userId, requestDetails);
    } else if (target.type === "bundle") {
      result = await couponService.validateCouponForBundle(target.couponCode, target.id, userId);
    } else {
      result = await couponService.validateCouponForBook(target.couponCode, target.id, userId);
    }

    return res.status(result.valid ? 200 : 400).json(result);
  });

  /**
   * Apply a coupon to calculate discounted price for a course, bundle, or book
   * POST /user/coupon/apply
   * Body: { coupon_code, course_id OR bundle_id OR book_id }
   */
  applyCoupon = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const target = parseCouponRequest(req.body);
    if (target.error) {
      return res.status(400).json({ success: false, error: target.error });
    }

    const userId = req.body.auth === true ? parseInt(req.body.user_id) : null;

    let result;
    if (target.type === "course") {
      result = await couponService.applyCouponToPrice(target.couponCode, target.id, userId);
    } else if (target.type === "bundle") {
      result = await couponService.applyCouponToPriceForBundle(target.couponCode, target.id, userId);
    } else {
      result = await couponService.applyCouponToPriceForBook(target.couponCode, target.id, userId);
    }
    const couponId = result.success && result.data && result.data.coupon ? result.data.coupon.id : null;

    // Track coupon click after successful application
    // NOTE: trackCouponClick only supports course_id/bundle_id today (see
    // coupon.js) — book clicks are intentionally not tracked here, matching
    // the scope of this task (recordUsage/linkClickToPurchase, used at actual
    // payment time, do support book_id; this is a separate pre-checkout
    // "apply" click-tracking path outside that scope).
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

        if (target.type === "course") {
          await couponService.trackCouponClick(couponId, userId, target.id, null, requestDetails);
        } else if (target.type === "bundle") {
          await couponService.trackCouponClick(couponId, userId, null, target.id, requestDetails);
        }
      } catch (trackError) {
        // Non-critical error - don't fail the request if tracking fails
        console.warn('Failed to track coupon click (non-critical):', trackError);
      }
    }

    return respond(res, result);
  });

  /**
   * Get active coupons for a specific course
   * GET /user/coupon/course/:course_id
   */
  getActiveCouponsForCourse = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const courseId = parseInt(req.params.course_id);

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        error: "Valid course ID is required",
      });
    }

    const result = await couponService.getActiveCouponsForCourse(courseId);
    return respond(res, result);
  });

}

module.exports = { UserCouponController };
