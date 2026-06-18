const { authenticateUser } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const NotificationController=require('../../controllers/user/notification').NotificationController
const { actorLimiter } = require("../../util/rateLimitPolicies");

const notificationController=new NotificationController()

const notificationLimit = actorLimiter(
  "notification:actor",
  30,
  15 * 60 * 1000,
  { message: "Too many notification requests. Please try again later." }
);

router.route("/list").get(authenticateUser, notificationLimit, notificationController.getNotifications);
router.route("/markAllAsRead").post(authenticateUser, notificationLimit, notificationController.markAllAsRead);
router
  .route("/count")
  .get(
    authenticateUser,
    notificationLimit,
    notificationController.getNotificationBellIcounUnclickedCount
  );
router.route("/bellIconClicked").post(authenticateUser, notificationLimit, notificationController.bellIconClicked);
router.route("/markAsRead/:id").post(authenticateUser, notificationLimit, notificationController.markAsRead);

module.exports=router
