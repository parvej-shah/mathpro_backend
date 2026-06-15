const Service = require('../base').Service;

class NotificationService extends Service {
  constructor() {
    super();
  }

  async getNotificationsPaginated(userId, courseId, limit, offset) {
    var query = `select * from notification where course_id = $1 and user_id = $2 order by timestamp desc limit $3 offset $4`;
    var params = [courseId, userId, limit, offset];
    var result = await this.query(query, params);
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
    // console.log(courseId);
    // console.log(userId);
    var query = `select count(*) from notification where user_id = $1 and course_id = $2 and is_bell_icon_clicked = $3`;
    var params = [userId, courseId, false];
    var result = await this.query(query, params);
    return result;
  }
}

module.exports = {NotificationService}