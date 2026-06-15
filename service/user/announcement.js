const Service = require('../base').Service;

class AnnouncementService extends Service {
  constructor() {
    super();
  }

  async getAnnouncementsByCourse(userId, courseId, limit, offset) {
    var query = `
      SELECT a.id, a.subject, a.description, a.created_at 
      FROM announcements a
      JOIN takes t ON t.course_id = a.course_id
      WHERE a.course_id = $1 
        AND t.user_id = $2
        AND a.notification_is_sent = true
      ORDER BY a.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    var params = [courseId, userId, limit, offset];
    var result = await this.query(query, params);
    return result;
  }

  async getTotalCount(userId, courseId) {
    var query = `
      SELECT COUNT(*) as count
      FROM announcements a
      JOIN takes t ON t.course_id = a.course_id
      WHERE a.course_id = $1 
        AND t.user_id = $2
        AND a.notification_is_sent = true
    `;
    var params = [courseId, userId];
    var result = await this.query(query, params);
    return result;
  }
}

module.exports = { AnnouncementService };
