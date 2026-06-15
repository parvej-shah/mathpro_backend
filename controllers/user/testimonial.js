const Controller = require("../base").Controller;
const TestimonialService = require("../../service/managerial/testimonial").TestimonialService;

const testimonialService = new TestimonialService();

class TestimonialController extends Controller {
  list = async (req, res) => {
    const result = await testimonialService.listPublic();
    return res.status(result.success ? 200 : 400).json(result);
  };
}

module.exports = { TestimonialController };
