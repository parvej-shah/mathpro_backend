const router = require("express-promise-router")();
const { UserCouponController } = require("../../controllers/user/coupon");
const {
  optAuthenticateUser,
} = require("../../service/authMiddleWares");
const { actorLimiter, ipLimiter } = require("../../util/rateLimitPolicies");

const userCouponController = new UserCouponController();

const couponActorLimit = actorLimiter(
  "coupon:actor",
  10,
  15 * 60 * 1000,
  { message: "Too many coupon attempts. Please try again later." }
);

const couponPublicLimit = ipLimiter(
  "coupon:public",
  60,
  15 * 60 * 1000,
  { message: "Too many coupon requests. Please try again later." }
);

// User coupon validation and application routes
router
  .route("/validate")
  .post(optAuthenticateUser, couponActorLimit, userCouponController.validateCoupon);
router
  .route("/apply")
  .post(optAuthenticateUser, couponActorLimit, userCouponController.applyCoupon);

// Get active coupons for a specific course (public endpoint for course display)
router
  .route("/course/:course_id")
  .get(couponPublicLimit, userCouponController.getActiveCouponsForCourse);

// Check coupon applicability to course (public endpoint for frontend validation)
router
  .route("/check-applicability")
  .get(couponPublicLimit, userCouponController.checkCouponApplicability);

module.exports = router;
