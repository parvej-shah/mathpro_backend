const router = require("express-promise-router")();
const FeedbackController = require("../../controllers/user/feedback").FeedbackController;
const { authenticateUser } = require("../../service/authMiddleWares");
const { actorLimiter, ipLimiter } = require("../../util/rateLimitPolicies");

const feedbackController = new FeedbackController();

const feedbackWriteLimit = actorLimiter(
  "feedback:write",
  10,
  15 * 60 * 1000,
  { message: "Too many feedback actions. Please try again later." }
);

const feedbackReadLimit = ipLimiter(
  "feedback:read",
  60,
  15 * 60 * 1000,
  { message: "Too many feedback requests. Please try again later." }
);

// Submit feedback
router.route("/").post(authenticateUser, feedbackWriteLimit, feedbackController.submitFeedback);

// Check user feedback status
router.route("/check/:userId/:courseId").get(authenticateUser, feedbackWriteLimit, feedbackController.checkFeedbackStatus);

// Get course average rating (public)
router.route("/course/:courseId/average").get(feedbackReadLimit, feedbackController.getCourseAverage);

// Get course feedbacks (public, paginated)
router.route("/course/:courseId").get(feedbackReadLimit, feedbackController.getCourseFeedbacks);

// Update feedback
router.route("/:feedbackId").put(authenticateUser, feedbackWriteLimit, feedbackController.updateFeedback);

// Delete feedback
router.route("/:feedbackId").delete(authenticateUser, feedbackWriteLimit, feedbackController.deleteFeedback);

module.exports = router;
