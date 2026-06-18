const router = require("express-promise-router")();
const { ModuleFeedbackController } = require("../../controllers/managerial/moduleFeedback");
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const { actorLimiter } = require("../../util/rateLimitPolicies");

const moduleFeedbackController = new ModuleFeedbackController();

const requireFeedbackManage = requirePermission(PERMISSIONS.FEEDBACK.MANAGE.ALL);

const moduleFeedbackReadLimit = actorLimiter(
  "admin-module-feedback:read",
  20,
  15 * 60 * 1000,
  { message: "Too many module feedback requests. Please try again later." }
);

const moduleFeedbackWriteLimit = actorLimiter(
  "admin-module-feedback:write",
  10,
  15 * 60 * 1000,
  { message: "Too many module feedback actions. Please try again later." }
);

router.route("/").get(requireFeedbackManage, moduleFeedbackReadLimit, moduleFeedbackController.getAllFeedback);
router.route("/export").get(requireFeedbackManage, moduleFeedbackWriteLimit, moduleFeedbackController.exportFeedback);

router.route("/reasons")
    .get(requireFeedbackManage, moduleFeedbackReadLimit, moduleFeedbackController.getAllReasons)
    .post(requireFeedbackManage, moduleFeedbackWriteLimit, moduleFeedbackController.createReason);

router.route("/reasons/reorder").patch(requireFeedbackManage, moduleFeedbackWriteLimit, moduleFeedbackController.updateReasonOrders);

router.route("/reasons/:id")
    .get(requireFeedbackManage, moduleFeedbackReadLimit, moduleFeedbackController.getReasonById)
    .put(requireFeedbackManage, moduleFeedbackWriteLimit, moduleFeedbackController.updateReason)
    .delete(requireFeedbackManage, moduleFeedbackWriteLimit, moduleFeedbackController.deleteReason);

router.route("/stats/:moduleId").get(requireFeedbackManage, moduleFeedbackReadLimit, moduleFeedbackController.getModuleStats);
router.route("/course/:courseId/report").get(requireFeedbackManage, moduleFeedbackReadLimit, moduleFeedbackController.getCourseReport);

module.exports = router;
