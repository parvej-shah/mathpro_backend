const Controller = require("../base").Controller;
const { respond, catchAs } = require('../base');
const CouponService = require("../../service/managerial/coupon");

const couponService = new CouponService();

// The coupon facade has one method per item type; this picks them by the request's target.
// clickIds gives trackCouponClick's (courseId, bundleId); null means clicks aren't tracked.
// trackCouponClick only supports course_id/bundle_id today, so book "apply" clicks are not
// tracked (recordUsage/linkClickToPurchase, used at payment time, do support book_id).
const COUPON_TARGET_OPS = {
  course: {
    validate: (t, userId, details) => couponService.validateCoupon(t.couponCode, t.id, userId, details),
    apply: (t, userId) => couponService.applyCouponToPrice(t.couponCode, t.id, userId),
    clickIds: (id) => [id, null],
  },
  bundle: {
    validate: (t, userId) => couponService.validateCouponForBundle(t.couponCode, t.id, userId),
    apply: (t, userId) => couponService.applyCouponToPriceForBundle(t.couponCode, t.id, userId),
    clickIds: (id) => [null, id],
  },
  book: {
    validate: (t, userId) => couponService.validateCouponForBook(t.couponCode, t.id, userId),
    apply: (t, userId) => couponService.applyCouponToPriceForBook(t.couponCode, t.id, userId),
    clickIds: null,
  },
};

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

    const result = await COUPON_TARGET_OPS[target.type].validate(target, userId, requestDetails);

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

    const ops = COUPON_TARGET_OPS[target.type];
    const result = await ops.apply(target, userId);
    const couponId = result.success && result.data && result.data.coupon ? result.data.coupon.id : null;

    // Track coupon click after successful application (courses and bundles; see COUPON_TARGET_OPS)
    if (result.success && couponId && userId && ops.clickIds) {
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

        const [courseId, bundleId] = ops.clickIds(target.id);
        await couponService.trackCouponClick(couponId, userId, courseId, bundleId, requestDetails);
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
