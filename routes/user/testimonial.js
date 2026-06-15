const router = require("express-promise-router")();
const TestimonialController = require("../../controllers/user/testimonial").TestimonialController;

const testimonialController = new TestimonialController();

router.route("/list").get(testimonialController.list);

module.exports = router;
