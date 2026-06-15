const router = require("express-promise-router")();
const TeacherController = require('../../controllers/managerial/teacher').TeacherController;
const { requirePermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');

const teacherController = new TeacherController();
const requireTeacherManage = requirePermission(PERMISSIONS.TEACHER.MANAGE.ALL);

router.route("/list").get(requireTeacherManage, teacherController.list);
router.route("/create").post(requireTeacherManage, teacherController.create);
router.route("/update/:id").put(requireTeacherManage, teacherController.update);
router.route("/delete/:id").delete(requireTeacherManage, teacherController.deleteEntry);
router.route("/reset-password/:id").put(requireTeacherManage, teacherController.forgotPassword);
router.route("/profile/:id").get(requireTeacherManage, teacherController.getTeacher);

module.exports=router