const Controller = require("../base").Controller;
const { respond } = require('../base');
const TestimonialService = require("../../service/managerial/testimonial").TestimonialService;

const testimonialService = new TestimonialService();

class TestimonialController extends Controller {
  list = async (req, res) => {
    const result = await testimonialService.listPublic();
    return respond(res, result);
  };
}

module.exports = { TestimonialController };
