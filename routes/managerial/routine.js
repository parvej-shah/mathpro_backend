const router = require("express-promise-router")();
const RoutineController = require("../../controllers/managerial/routine").RoutineController;
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const routineController = new RoutineController();

const requireRoutineManage = requirePermission(PERMISSIONS.ROUTINE.MANAGE.ALL);

router.route("/list").get(requireRoutineManage, routineController.list);
router.route("/course/:courseId").get(requireRoutineManage, routineController.listByCourse);
router.route("/get/:id").get(requireRoutineManage, routineController.getEntry);
router.route("/create/:courseId").post(requireRoutineManage, routineController.create);
router.route("/update/:id").put(requireRoutineManage, routineController.update);
router.route("/delete/:id").delete(requireRoutineManage, routineController.deleteEntry);
router.route("/toggle-active/:id").patch(requireRoutineManage, routineController.toggleActive);

module.exports = router;
