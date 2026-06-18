const router = require("express-promise-router")();
const FeedbackController = require("../../controllers/managerial/feedback").FeedbackController;
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const { actorLimiter } = require("../../util/rateLimitPolicies");

const feedbackController = new FeedbackController();

const requireFeedbackManage = requirePermission(PERMISSIONS.FEEDBACK.MANAGE.ALL);

const feedbackReadLimit = actorLimiter(
  "admin-feedback:read",
  20,
  15 * 60 * 1000,
  { message: "Too many feedback requests. Please try again later." }
);

const feedbackExportLimit = actorLimiter(
  "admin-feedback:export",
  5,
  60 * 60 * 1000,
  { message: "Too many export requests. Please try again later." }
);

// Get all feedbacks with filtering and pagination
router.route("/").get(requireFeedbackManage, feedbackReadLimit, feedbackController.getAllFeedbacks);

// Get feedback statistics
router.route("/stats").get(requireFeedbackManage, feedbackReadLimit, feedbackController.getFeedbackStats);

// Export feedbacks (must be before /:feedbackId so "export" is not matched as feedbackId)
router.route("/export").get(requireFeedbackManage, feedbackExportLimit, feedbackController.exportFeedbacks);

// Delete feedback (admin)
router.route("/:feedbackId").delete(requireFeedbackManage, feedbackExportLimit, feedbackController.deleteFeedback);

module.exports = router;
