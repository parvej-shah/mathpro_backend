const Controller = require("../base").Controller;
const { handle } = require('../base');
const TestimonialService = require("../../service/managerial/testimonial").TestimonialService;

const testimonialService = new TestimonialService();

class TestimonialController extends Controller {
  list = handle(() => testimonialService.listPublic());
}

module.exports = { TestimonialController };
