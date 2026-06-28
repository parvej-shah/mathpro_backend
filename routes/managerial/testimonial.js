const router = require("express-promise-router")();
const TestimonialController = require("../../controllers/managerial/testimonial").TestimonialController;
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const { revalidateOnWrite } = require("../../util/revalidateFrontend");

const testimonialController = new TestimonialController();
const requireFeedbackManage = requirePermission(PERMISSIONS.FEEDBACK.MANAGE.ALL);

// A testimonial write changes the marquee shown on /, /courses, /combos.
router.use(revalidateOnWrite(["public-testimonials"]));

router.route("/list").get(requireFeedbackManage, testimonialController.list);
router.route("/create").post(requireFeedbackManage, testimonialController.create);
router.route("/update/:feedbackId").put(requireFeedbackManage, testimonialController.update);
router.route("/delete/:feedbackId").delete(requireFeedbackManage, testimonialController.deleteEntry);

module.exports = router;
