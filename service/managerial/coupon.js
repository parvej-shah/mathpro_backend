const { Service } = require("../base");
const { CouponCrudService } = require("./coupon/crud");
const { CouponTargetingService } = require("./coupon/targeting");
const { CouponRedemptionService } = require("./coupon/redemption");
const { CouponClickTrackingService } = require("./coupon/clickTracking");
const { CouponAnalyticsService } = require("./coupon/analytics");

// Facade over the coupon services in ./coupon/: every method of each part is exposed here
// under its own name, so callers keep using `new CouponService().anyMethod(...)`.
class CouponService extends Service {
  constructor() {
    super();
    const clicks = new CouponClickTrackingService();
    const parts = [
      new CouponCrudService(),
      new CouponTargetingService(),
      new CouponRedemptionService(clicks),
      clicks,
      new CouponAnalyticsService(),
    ];
    for (const part of parts) {
      for (const [name, method] of Object.entries(part)) {
        // The Service base methods (query, …) are the facade's own.
        if (typeof method === "function" && !(name in this)) this[name] = method;
      }
    }
  }
}

module.exports = CouponService;
