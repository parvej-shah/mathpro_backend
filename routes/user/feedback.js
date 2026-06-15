const router = require("express-promise-router")();
const FeedbackController = require("../../controllers/user/feedback").FeedbackController;
const { authenticateUser } = require("../../service/authMiddleWares");

const feedbackController = new FeedbackController();

// Submit feedback
router.route("/").post(authenticateUser, feedbackController.submitFeedback);

// Check user feedback status
router.route("/check/:userId/:courseId").get(authenticateUser, feedbackController.checkFeedbackStatus);

// Get course average rating (public)
router.route("/course/:courseId/average").get(feedbackController.getCourseAverage);

// Get course feedbacks (public, paginated)
router.route("/course/:courseId").get(feedbackController.getCourseFeedbacks);

// Update feedback
router.route("/:feedbackId").put(authenticateUser, feedbackController.updateFeedback);

// Delete feedback
router.route("/:feedbackId").delete(authenticateUser, feedbackController.deleteFeedback);

module.exports = router;