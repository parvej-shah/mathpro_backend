const router = require("express-promise-router")();
const TestimonialController = require("../../controllers/managerial/testimonial").TestimonialController;
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const testimonialController = new TestimonialController();
const requireFeedbackManage = requirePermission(PERMISSIONS.FEEDBACK.MANAGE.ALL);

router.route("/list").get(requireFeedbackManage, testimonialController.list);
router.route("/create").post(requireFeedbackManage, testimonialController.create);
router.route("/update/:feedbackId").put(requireFeedbackManage, testimonialController.update);
router.route("/delete/:feedbackId").delete(requireFeedbackManage, testimonialController.deleteEntry);

module.exports = router;
