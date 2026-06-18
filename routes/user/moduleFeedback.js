const router = require("express-promise-router")();
const { ModuleFeedbackController } = require("../../controllers/user/moduleFeedback");
const { authenticateUser } = require("../../service/authMiddleWares");
const { actorLimiter } = require("../../util/rateLimitPolicies");

const moduleFeedbackController = new ModuleFeedbackController();

const moduleFeedbackReadLimit = actorLimiter(
  "module-feedback:read",
  30,
  15 * 60 * 1000,
  { message: "Too many module feedback requests. Please try again later." }
);

const moduleFeedbackWriteLimit = actorLimiter(
  "module-feedback:write",
  10,
  15 * 60 * 1000,
  { message: "Too many module feedback actions. Please try again later." }
);

// All routes require user authentication
router.use(authenticateUser);

// POST /user/module-feedback - Submit or update feedback
router.route("/")
    .post(moduleFeedbackWriteLimit, moduleFeedbackController.submitFeedback);

// GET /user/module-feedback/reasons - Get available feedback reasons
router.route("/reasons")
    .get(moduleFeedbackReadLimit, moduleFeedbackController.getAvailableReasons);

// GET /user/module-feedback/course/:courseId - Get user's feedback for all modules in a course
router.route("/course/:courseId")
    .get(moduleFeedbackReadLimit, moduleFeedbackController.getCourseFeedback);

// GET /user/module-feedback/:moduleId - Get user's feedback for a specific module
// DELETE /user/module-feedback/:moduleId - Delete user's feedback
router.route("/:moduleId")
    .get(moduleFeedbackReadLimit, moduleFeedbackController.getModuleFeedback)
    .delete(moduleFeedbackWriteLimit, moduleFeedbackController.deleteFeedback);

// GET /user/module-feedback/:moduleId/stats - Get module stats with user's reaction
router.route("/:moduleId/stats")
    .get(moduleFeedbackReadLimit, moduleFeedbackController.getModuleStats);

module.exports = router;
