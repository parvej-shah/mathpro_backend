const router = require("express-promise-router")();
const TestimonialController = require("../../controllers/user/testimonial").TestimonialController;
const { ipLimiter } = require("../../util/rateLimitPolicies");

const testimonialController = new TestimonialController();

const testimonialListLimit = ipLimiter(
  "testimonial:list",
  30,
  15 * 60 * 1000,
  { message: "Too many testimonial requests. Please try again later." }
);

router.route("/list").get(testimonialListLimit, testimonialController.list);

module.exports = router;
