const router = require("express-promise-router")();
const { ModuleFeedbackController } = require("../../controllers/user/moduleFeedback");
const { authenticateUser } = require("../../service/authMiddleWares");

const moduleFeedbackController = new ModuleFeedbackController();

// All routes require user authentication
router.use(authenticateUser);

// POST /user/module-feedback - Submit or update feedback
router.route("/")
    .post(moduleFeedbackController.submitFeedback);

// GET /user/module-feedback/reasons - Get available feedback reasons
router.route("/reasons")
    .get(moduleFeedbackController.getAvailableReasons);

// GET /user/module-feedback/course/:courseId - Get user's feedback for all modules in a course
router.route("/course/:courseId")
    .get(moduleFeedbackController.getCourseFeedback);

// GET /user/module-feedback/:moduleId - Get user's feedback for a specific module
// DELETE /user/module-feedback/:moduleId - Delete user's feedback
router.route("/:moduleId")
    .get(moduleFeedbackController.getModuleFeedback)
    .delete(moduleFeedbackController.deleteFeedback);

// GET /user/module-feedback/:moduleId/stats - Get module stats with user's reaction
router.route("/:moduleId/stats")
    .get(moduleFeedbackController.getModuleStats);

module.exports = router;

