const Service = require('../base').Service;

class NotificationService extends Service {
  constructor() {
    super();
  }

  normalizeNotificationRow(notification) {
    const { ...baseNotification } = notification;

    const data = baseNotification.data && typeof baseNotification.data === 'object'
      ? notification.data
      : {};

    if (baseNotification.type === 'ANNOUNCEMENT') {
      const body = data.body ?? null;
      const title = data.title ?? null;

      return {
        ...baseNotification,
        data: {
          ...data,
          title,
          body,
          html: data.html ?? body,
          moduleData: data.moduleData ?? {},
        },
      };
    }

    return {
      ...baseNotification,
      data: {
        ...data,
        moduleData: data.moduleData ?? {},
      },
    };
  }

  async getNotificationsPaginated(userId, courseId, limit, offset) {
    var query = `
      select
        n.*
      from notification n
      where n.course_id = $1 and n.user_id = $2
      order by n.timestamp desc
      limit $3 offset $4`;
    var params = [courseId, userId, limit, offset];
    var result = await this.query(query, params);
    if (result.success) {
      result.data = result.data.map((notification) =>
        this.normalizeNotificationRow(notification)
      );
    }
    return result;
  }

  async markAllAsRead(userId, courseId) {
    var query = `update notification set is_read = $1 where user_id = $2 and course_id = $3`;
    var params = [true, userId, courseId];
    var result = await this.query(query, params);
    return result;
  }
  async markAsRead(id,userId, courseId) {
    //console.log(id,courseId,userId);
    var query = `update notification set is_read = $1 where id = $2 and user_id = $3 and course_id = $4`;
    var params = [true,id, userId, courseId];
    var result = await this.query(query, params);
    return result;
  }
  async bellIconClicked(userId, courseId) {
    var query = `update notification set is_bell_icon_clicked = $1 where user_id = $2 and course_id = $3`;
    var params = [true, userId, courseId];
    var result = await this.query(query, params);
    return result;
  }

  async getNotificationBellIcounUnclickedCount(userId, courseId) {
    var query = `select count(*) from notification where user_id = $1 and course_id = $2 and is_read = $3`;
    var params = [userId, courseId, false];
    var result = await this.query(query, params);
    return result;
  }
}

module.exports = {NotificationService}
