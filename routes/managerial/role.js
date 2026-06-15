const router = require("express-promise-router")();
const { RoleController } = require("../../controllers/managerial/role");
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const roleController = new RoleController();

// Phase 5: All role management endpoints require role.manage.all
const requireRoleManage = requirePermission(PERMISSIONS.ROLE.MANAGE.ALL);

// List of valid permissions (must be before /:id so "permissions" is not matched as id)
router.route("/permissions").get(requireRoleManage, roleController.getPermissionsList);

// Role CRUD operations
router.route("/").get(requireRoleManage, roleController.listRoles);
router.route("/").post(requireRoleManage, roleController.createRole);
router.route("/:id").get(requireRoleManage, roleController.getRole);
router.route("/:id").put(requireRoleManage, roleController.updateRole);
router.route("/:id").delete(requireRoleManage, roleController.deleteRole);

// User role management
router.route("/users/:userId/roles").get(requireRoleManage, roleController.getUserRoles);
router.route("/users/:userId/roles").post(requireRoleManage, roleController.assignRole);
router.route("/users/:userId/roles/:roleId").delete(requireRoleManage, roleController.removeRole);

// User permissions (read-only)
router.route("/users/:userId/permissions").get(requireRoleManage, roleController.getUserPermissions);

module.exports = router;

