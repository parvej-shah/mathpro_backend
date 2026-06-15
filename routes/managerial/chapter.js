const router = require("express-promise-router")();
const ChapterController = require('../../controllers/managerial/chapter').ChapterController;
const { requirePermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');

const chapterController = new ChapterController();
const requireChapterManage = requirePermission(PERMISSIONS.CHAPTER.MANAGE.ALL);

router.route("/list/:id").get(requireChapterManage, chapterController.list);
router.route("/get/:id").get(requireChapterManage, chapterController.getEntry);
router.route("/create/:id").post(requireChapterManage, chapterController.create);
router.route("/update/:id").put(requireChapterManage, chapterController.update);
router.route("/delete/:id").delete(requireChapterManage, chapterController.deleteEntry);

module.exports=router