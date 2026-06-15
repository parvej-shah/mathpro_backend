const { authenticateAdmin, requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const router = require("express-promise-router")();
const { UserController } = require("../../controllers/managerial/user");

const userController = new UserController();

// User Management - require user.manage.all
const requireUserManage = requirePermission(PERMISSIONS.USER.MANAGE.ALL);

// User CRUD operations
router.route("/").get(requireUserManage, userController.list);
router.route("/").post(requireUserManage, userController.create);
router.route("/:id").get(requireUserManage, userController.get);
router.route("/:id/history").get(requireUserManage, userController.getHistory);
router.route("/:id").put(requireUserManage, userController.update);
router.route("/:id").delete(requireUserManage, userController.delete);

// Password reset endpoint
router.route("/:id/reset-password").post(requireUserManage, userController.resetPassword);

// Unified student access management from user namespace (type=course|bundle)
router.route("/:id/access").get(requireUserManage, userController.getUserCourseAccess);
router.route("/:id/access").post(requireUserManage, userController.grantUserCourseAccess);
router.route("/:id/access").delete(requireUserManage, userController.revokeUserCourseAccess);

module.exports = router;
