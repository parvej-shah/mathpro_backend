const router = require("express-promise-router")();
const AnnouncementController =
  require("../../controllers/managerial/announcement").AnnouncementController;
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const announcementController = new AnnouncementController();

const requireAnnouncementManage = requirePermission(PERMISSIONS.ANNOUNCEMENT.MANAGE.ALL);

router
  .route("/list")
  .get(requireAnnouncementManage, announcementController.getAnnouncements);
router
  .route("/list/:courseId")
  .get(requireAnnouncementManage, announcementController.getAnnouncementsCourseWise);
router.route("/get/:id").get(requireAnnouncementManage, announcementController.getAnnouncementById);
router.route("/create/:courseId").post(requireAnnouncementManage, announcementController.create);
router.route("/update/:id").put(requireAnnouncementManage, announcementController.update);
router.route("/delete/:id").delete(requireAnnouncementManage, announcementController.delete);
router.route("/send/:id").post(requireAnnouncementManage, announcementController.send);
module.exports = router;
