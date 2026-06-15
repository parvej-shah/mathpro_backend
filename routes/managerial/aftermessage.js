const router = require("express-promise-router")();
const { AdminAfterMessageController } = require("../../controllers/managerial/aftermessage");
const { requireScopeAccess } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const adminAfterMessageController = new AdminAfterMessageController();

const requireMessageManage = requireScopeAccess("message", "manage");

router.route("/").get(requireMessageManage, adminAfterMessageController.getAllMessages);
router.route("/").post(requireMessageManage, adminAfterMessageController.createMessage);
router.route("/:id").put(requireMessageManage, adminAfterMessageController.updateMessage);
router.route("/:id").delete(requireMessageManage, adminAfterMessageController.deleteMessage);

module.exports = router;
