const router = require("express-promise-router")();
const { UserCouponController } = require("../../controllers/user/coupon");
const {
  authenticateUser,
  optAuthenticateUser,
} = require("../../service/authMiddleWares");

const userCouponController = new UserCouponController();

// User coupon validation and application routes
router
  .route("/validate")
  .post(optAuthenticateUser, userCouponController.validateCoupon);
router
  .route("/apply")
  .post(optAuthenticateUser, userCouponController.applyCoupon);

// Get active coupons for a specific course (public endpoint for course display)
router
  .route("/course/:course_id")
  .get(userCouponController.getActiveCouponsForCourse);

// Check coupon applicability to course (public endpoint for frontend validation)
router
  .route("/check-applicability")
  .get(userCouponController.checkCouponApplicability);

module.exports = router;
