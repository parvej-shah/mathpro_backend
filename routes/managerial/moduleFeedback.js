const router = require("express-promise-router")();
const { ModuleFeedbackController } = require("../../controllers/managerial/moduleFeedback");
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const moduleFeedbackController = new ModuleFeedbackController();

const requireFeedbackManage = requirePermission(PERMISSIONS.FEEDBACK.MANAGE.ALL);

router.route("/").get(requireFeedbackManage, moduleFeedbackController.getAllFeedback);
router.route("/export").get(requireFeedbackManage, moduleFeedbackController.exportFeedback);

router.route("/reasons")
    .get(requireFeedbackManage, moduleFeedbackController.getAllReasons)
    .post(requireFeedbackManage, moduleFeedbackController.createReason);

router.route("/reasons/reorder").patch(requireFeedbackManage, moduleFeedbackController.updateReasonOrders);

router.route("/reasons/:id")
    .get(requireFeedbackManage, moduleFeedbackController.getReasonById)
    .put(requireFeedbackManage, moduleFeedbackController.updateReason)
    .delete(requireFeedbackManage, moduleFeedbackController.deleteReason);

router.route("/stats/:moduleId").get(requireFeedbackManage, moduleFeedbackController.getModuleStats);
router.route("/course/:courseId/report").get(requireFeedbackManage, moduleFeedbackController.getCourseReport);

module.exports = router;
