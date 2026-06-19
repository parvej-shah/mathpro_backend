const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const router = require("express-promise-router")();
const { AdminController } = require("../../controllers/managerial/admin");

const adminController = new AdminController();

// Phase 5: Admin Management - require admin.manage.all
const requireAdminManage = requirePermission(PERMISSIONS.ADMIN.MANAGE.ALL);

// Admin CRUD operations
router.route("/").get(requireAdminManage, adminController.list);
router.route("/").post(requireAdminManage, adminController.create);

// Search users (must be before /:id to avoid param capture)
router.route("/search-users").get(requireAdminManage, adminController.searchUsers);

router.route("/:id").get(requireAdminManage, adminController.get);
router.route("/:id").put(requireAdminManage, adminController.update);
router.route("/:id").delete(requireAdminManage, adminController.delete);

// Set password & promote endpoints
router.route("/:id/set-password").post(requireAdminManage, adminController.setPassword);
router.route("/:id/promote").post(requireAdminManage, adminController.promote);

module.exports = router;

