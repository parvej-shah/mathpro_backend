const Controller = require("../base").Controller;
const NotificationService=require("../../service/user/notification").NotificationService

const notificationService=new NotificationService()

class NotificationController extends Controller {
  constructor() {
    super();
  }

  getNotifications = async (req, res) => {
    var result = await notificationService.getNotificationsPaginated(
      req.body.user_id,
      parseInt(req.query.courseId),
      parseInt(req.query.limit),
      parseInt(req.query.offset)
    );
    return res.status(result.success ? 200 : 400).json(result);
  };

  markAllAsRead = async (req, res) => {
    var result = await notificationService.markAllAsRead(
      req.body.user_id,
      parseInt(req.query.courseId)
    );
    return res.status(result.success ? 200 : 400).json(result);
  };
  markAllAsRead = async (req, res) => {
    var result = await notificationService.markAllAsRead(
      req.body.user_id,
      parseInt(req.query.courseId)
    );
    return res.status(result.success ? 200 : 400).json(result);
  };
  markAsRead = async (req, res) => {
    var result = await notificationService.markAsRead(
      req.params.id,
      req.body.user_id,
      parseInt(req.query.courseId)
    );
    return res.status(result.success ? 200 : 400).json(result);
  };
  bellIconClicked = async (req, res) => {
    var result = await notificationService.bellIconClicked(
      req.body.user_id,
      parseInt(req.query.courseId)
    );
    return res.status(result.success ? 200 : 400).json(result);
  };

  getNotificationBellIcounUnclickedCount = async (req, res) => {
    var result =
      await notificationService.getNotificationBellIcounUnclickedCount(
        req.body.user_id,
        parseInt(req.query.courseId)
      );
    return res.status(result.success ? 200 : 400).json(result);
  };
}

module.exports={NotificationController}

