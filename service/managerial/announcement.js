const Service = require('../base').Service;

class AnnouncementService extends Service {
  constructor() {
    super();
  }
  table = `announcements`;
  pk = `id`;
  fk = `course_id`;
  cols = [
    `user_type`,
    `subject`,
    `description`,
    `sent_methods`,
    `email_is_sent`,
    `sms_is_sent`,
    `notification_is_sent`,
    `created_at`,
  ];
  has_notification = false;
  sanitizeSentMethods = (sentMethods) => {
    if (!Array.isArray(sentMethods)) return [];
    return sentMethods.filter((method) => method === "notification");
  };
  getColumnsWithParenthesis = () => {
    var result = `(`;
    this.cols.map((c, i) => {
      result += `${c},`;
    });
    result += `${this.fk}`;
    return `${result})`;
  };
  getWildCards = () => {
    var result = `(`;
    var fields = [...this.cols];
    var i = 0;
    fields.map((_, i) => {
      result += `$${i + 1},`;
    });
    result += `$${fields.length + 1}`;
    return result + ")";
  }
  getUpdatePairs = () => {
    return this.cols.map((c, i) => `${c}=$${i + 1}`)
  }
  intitializeBooleans = (reqObj) => {
    const sanitizedMethods = this.sanitizeSentMethods(reqObj);
    this.has_notification = sanitizedMethods.includes('notification');
  }
  async getAllAnnouncementsPaginated(limit, offset, access) {
    let query = `select * from ${this.table}`;
    let params = [];
    if (access && !access.hasGlobalAccess) {
      query += ` where course_id = ANY($1)`;
      params = [access.courseIds, limit, offset];
      query += ` order by id desc limit $2 offset $3`;
    } else {
      params = [limit, offset];
      query += ` order by id desc limit $1 offset $2`;
    }
    const result = await this.query(query, params);
    return result;
  }
  async getAllAnnouncementsCourseWisePaginated(courseId, limit, offset) {
    var query = `select * from ${this.table} where course_id = $1 order by id desc limit $2 offset $3`;
    var params = [courseId, limit, offset];
    const result = await this.query(query, params);
    return result;
  }
  async getEntry(id) {
    var query = `select * from ${this.table} where id=$1`;
    var params = [id];
    const result = await this.query(query, params);
    return result;
  }
  async create(fk_id, reqObj) {
    var query = `insert into ${this.table} ${this.getColumnsWithParenthesis()} values ${this.getWildCards()} returning id`;
    var params = [
      ...this.cols.map((c) => {
        if(c==='user_type') return 3;
        else if (c === "created_at") return parseInt(Date.now() / 1000);
        else if (c === "email_is_sent") return false;
        else if (c === "sms_is_sent") return false;
        else if (c === "notification_is_sent") return false;
        else if (c === "sent_methods") return ["notification"];
        else return reqObj[c];
      }),fk_id
    ];
    const result = await this.query(query, params);
    return result;
  }
  deleteEntry(id) {
    var query = `delete from ${this.table} where id=$1`;
    var params = [id];
    const result = this.query(query, params);
    return result;
  }
  updateEntry(id, reqObj) { 
    var query = `update ${this.table} set ${this.getUpdatePairs()} where id=$${this.cols.length + 1} returning id`;
    var params = [
      ...this.cols.map((c) => {
        if (c === "user_type") return 3;
        else if (c === "created_at") return parseInt(Date.now() / 1000);
        else if (c === "email_is_sent") return false;
        else if (c === "sms_is_sent") return false;
        else if (c === "notification_is_sent") return false;
        else if (c === "sent_methods") return ["notification"];
        else return reqObj[c];
      }),id
    ];
    const result = this.query(query, params);
    return result;
  }
  async send(id) {
    var query = `select * from ${this.table} where id=$1`;
    var params = [id];
    var announcement_query_execution = await this.query(query, params);
    var announcement = announcement_query_execution.data?.[0];
    if (!announcement) {
      return { success: false, message: 'Announcement not found', data: null };
    }
    this.intitializeBooleans(announcement.sent_methods || []);
    if (this.has_notification) {
      const notificationResult = await this.sendNotification(announcement);
      if (!notificationResult.success) {
        return notificationResult;
      }
    }
    return announcement_query_execution;
  }
  async updateNotificationIsSentStatus(id) {
    var query = `update ${this.table} set notification_is_sent=true where id=$1 returning id`;
    var params = [id];
    const result = this.query(query, params);
    return result;
  }
  async sendNotification(announcement) {
    var query2 = `INSERT INTO notification (type, data, user_id, course_id, is_read, timestamp, announcement_id)
                    SELECT 
	                    $1 AS type,
                        $2 AS data,
                        t.user_id AS user_id,
                        c.id AS course_id,
                        $3 AS is_read,
                        $4 AS timestamp,
                        $5 AS announcement_id
                    FROM course AS c
                    JOIN takes AS t ON c.id = t.course_id
                    WHERE c.id = $6`;
    var params2 = [
      "ANNOUNCEMENT",
      {
        title: announcement.subject,
        moduleData: {},
      },
      false,
      parseInt(Date.now() / 1000),
      announcement.course_id,
      announcement.id,
    ];
    var notification_generator = await this.query(query2, params2);
    if (notification_generator.success) {
      await this.updateNotificationIsSentStatus(announcement.id);
    }
    return notification_generator;
  }
}

module.exports = {AnnouncementService}
