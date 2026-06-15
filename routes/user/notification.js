const { authenticateUser } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const NotificationController=require('../../controllers/user/notification').NotificationController

const notificationController=new NotificationController()

router.route("/list").get(authenticateUser,notificationController.getNotifications);
router.route("/markAllAsRead").post(authenticateUser,notificationController.markAllAsRead);
router
  .route("/count")
  .get(
    authenticateUser,
    notificationController.getNotificationBellIcounUnclickedCount
  );
router.route("/bellIconClicked").post(authenticateUser,notificationController.bellIconClicked);
router.route("/markAsRead/:id").post(authenticateUser,notificationController.markAsRead);

module.exports=router