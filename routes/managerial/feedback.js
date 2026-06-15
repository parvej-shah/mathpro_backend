const router = require("express-promise-router")();
const FeedbackController = require("../../controllers/managerial/feedback").FeedbackController;
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const feedbackController = new FeedbackController();

const requireFeedbackManage = requirePermission(PERMISSIONS.FEEDBACK.MANAGE.ALL);

// Get all feedbacks with filtering and pagination
router.route("/").get(requireFeedbackManage, feedbackController.getAllFeedbacks);

// Get feedback statistics
router.route("/stats").get(requireFeedbackManage, feedbackController.getFeedbackStats);

// Export feedbacks (must be before /:feedbackId so "export" is not matched as feedbackId)
router.route("/export").get(requireFeedbackManage, feedbackController.exportFeedbacks);

// Delete feedback (admin)
router.route("/:feedbackId").delete(requireFeedbackManage, feedbackController.deleteFeedback);

module.exports = router;