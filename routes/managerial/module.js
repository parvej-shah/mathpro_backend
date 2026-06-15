const router = require("express-promise-router")();
const ModuleController = require('../../controllers/managerial/module').ModuleController;
const { requirePermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');

const moduleController = new ModuleController();
const requireModuleManage = requirePermission(PERMISSIONS.MODULE.MANAGE.ALL);

router.route("/list/:id").get(requireModuleManage, moduleController.list);
router.route("/get/:id").get(requireModuleManage, moduleController.getEntry);
router.route("/create/:id").post(requireModuleManage, moduleController.create);
router.route("/update/:id").put(requireModuleManage, moduleController.update);
router.route("/delete/:id").delete(requireModuleManage, moduleController.deleteEntry);

module.exports=router