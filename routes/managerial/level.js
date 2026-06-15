const { authenticateInv, authenticateUser, requirePermission } = require("../../service/authMiddleWares");
const router = require("express-promise-router")();
const LevelController = require('../../controllers/managerial/level').LevelController;
const { PERMISSIONS } = require('../../util/permissions');

const levelController = new LevelController();

const requireLevelManage = requirePermission(PERMISSIONS.LEVEL.MANAGE.ALL);

router.route("/list/:id").get(authenticateInv, levelController.list);
router.route("/get/:id").get(authenticateInv, levelController.getEntry);
router.route("/create/:id").post(requireLevelManage, levelController.create);
router.route("/update/:id").put(requireLevelManage, levelController.update);
router.route("/delete/:id").delete(requireLevelManage, levelController.deleteEntry);

router.route("/requestGift/:level_id").post(authenticateUser, levelController.requestGift);
router.route("/getGiftRequests").get(requireLevelManage, levelController.getGiftRequests);
router.route("/approveGiftRequest").put(requireLevelManage, levelController.approveGift);
router.route("/getGiftPage/:course_id").get(authenticateUser, levelController.getGiftPage);

module.exports = router;
