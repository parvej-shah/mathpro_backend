const couponValidate = require("./coupon_validate");
const couponApply = require("./coupon_apply");
const couponGetActive = require("./coupon_get_active");
const couponCheckApplicability = require("./coupon_check_applicability");

module.exports = {
  paths: {
    "/user/coupon/validate": {
      ...couponValidate,
    },
    "/user/coupon/apply": {
      ...couponApply,
    },
    "/user/coupon/course/{course_id}": {
      ...couponGetActive,
    },
    "/user/coupon/check-applicability": {
      ...couponCheckApplicability,
    },
  },
};
