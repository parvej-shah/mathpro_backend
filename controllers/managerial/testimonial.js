const Controller = require("../base").Controller;
const TestimonialService = require("../../service/managerial/testimonial").TestimonialService;
const { getAccessibleCourseIds } = require("../../util/courseAccessHelpers");

const testimonialService = new TestimonialService();

class TestimonialController extends Controller {
  list = async (req, res) => {
    const access = await getAccessibleCourseIds(req.user.id, "feedback", "manage");
    const result = await testimonialService.listAdmin(access);
    return res.status(result.success ? 200 : 400).json(result);
  };

  create = async (req, res) => {
    const access = await getAccessibleCourseIds(req.user.id, "feedback", "manage");
    const result = await testimonialService.create(req.body, access);
    const code =
      !result.success && result.error === "NO_COURSE_ACCESS" ? 403 : result.success ? 200 : 400;
    return res.status(code).json(result);
  };

  update = async (req, res) => {
    const access = await getAccessibleCourseIds(req.user.id, "feedback", "manage");
    const result = await testimonialService.update(req.params.feedbackId, req.body, access);
    const code =
      !result.success && result.error === "NO_COURSE_ACCESS" ? 403 : result.success ? 200 : 400;
    return res.status(code).json(result);
  };

  deleteEntry = async (req, res) => {
    const access = await getAccessibleCourseIds(req.user.id, "feedback", "manage");
    const result = await testimonialService.deleteEntry(req.params.feedbackId, access);
    const code =
      !result.success && result.error === "NO_COURSE_ACCESS" ? 403 : result.success ? 200 : 400;
    return res.status(code).json(result);
  };
}

module.exports = { TestimonialController };
