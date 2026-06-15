const router = require("express-promise-router")();
const LiveController = require('../../controllers/managerial/live').LiveController;
const { requirePermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');

const liveController = new LiveController();

const requireLiveManage = requirePermission(PERMISSIONS.LIVE.MANAGE.ALL);

router.route("/list").get(requireLiveManage, liveController.list);
router.route("/get/:id").get(requireLiveManage, liveController.getEntry);
router.route("/create/:id").post(requireLiveManage, liveController.create);
router.route("/update/:id").put(requireLiveManage, liveController.update);
router.route("/delete/:id").delete(requireLiveManage, liveController.deleteEntry);
router.route("/interestCount/:id").get(requireLiveManage, liveController.interestCount);

router.route("/bulk-import").post(requireLiveManage, liveController.bulkImport);
router.route("/export").get(requireLiveManage, liveController.exportCSV);
router.route("/template").get(requireLiveManage, liveController.getImportTemplate);
router.route("/bulk-delete").delete(requireLiveManage, liveController.bulkDelete);

module.exports = router;