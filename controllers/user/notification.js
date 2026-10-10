const Controller = require("../base").Controller;
const { respond } = require('../base');
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
    return respond(res, result);
  };

  markAllAsRead = async (req, res) => {
    var result = await notificationService.markAllAsRead(
      req.body.user_id,
      parseInt(req.query.courseId)
    );
    return respond(res, result);
  };
  markAsRead = async (req, res) => {
    var result = await notificationService.markAsRead(
      req.params.id,
      req.body.user_id,
      parseInt(req.query.courseId)
    );
    return respond(res, result);
  };

  getNotificationBellIcounUnclickedCount = async (req, res) => {
    var result =
      await notificationService.getNotificationBellIcounUnclickedCount(
        req.body.user_id,
        parseInt(req.query.courseId)
      );
    return respond(res, result);
  };
}

module.exports={NotificationController}
