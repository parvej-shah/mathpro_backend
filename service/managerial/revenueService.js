const Service = require("../base").Service;

class RevenueService extends Service {
  constructor() {
    super();
  }

  getRevenue = async (courseId) => {
    const query = `select sum(amount) as n from takes where course_id=$1`;
    return this.query(query, [courseId]);
  };

  getAllRevenue = async (access) => {
    let query = `
            SELECT c.id as course_id, c.title as course_name, COALESCE(SUM(t.amount), 0) as revenue
            FROM course c
            LEFT JOIN takes t ON c.id = t.course_id
        `;
    let params = [];

    if (access && !access.hasGlobalAccess) {
      query += ` WHERE c.id = ANY($1)`;
      params = [access.courseIds];
    }

    query += ` GROUP BY c.id, c.title ORDER BY c.id`;
    return this.query(query, params);
  };

  getDetailedRevenue = async (courseId = null, access = null) => {
    try {
      let query;
      let params = [];

      if (courseId) {
        query = `
                    SELECT 
                        c.title as course_name,
                        c.price,
                        COUNT(DISTINCT t.user_id) as total_students,
                        COALESCE(SUM(t.amount), 0) as total_revenue,
                        COALESCE(AVG(t.amount), 0) as average_payment,
                        MIN(t.timestamp) as first_sale_timestamp,
                        MAX(t.timestamp) as recent_sale_timestamp
                    FROM course c
                    LEFT JOIN takes t ON c.id = t.course_id
                    WHERE c.id = $1
                    GROUP BY c.id, c.title, c.price
                `;
        params = [courseId];
      } else if (access && !access.hasGlobalAccess && access.courseIds && access.courseIds.length > 0) {
        query = `
                      SELECT 
                          COALESCE(SUM(t.amount), 0) as total_revenue,
                          (
                              SELECT COALESCE(SUM(amount), 0) 
                              FROM takes 
                              WHERE timestamp >= extract(epoch from date_trunc('day', now()))
                                AND course_id = ANY($1)
                          ) as revenue_today,
                          (
                              SELECT COALESCE(SUM(amount), 0) 
                              FROM takes 
                              WHERE timestamp >= extract(epoch from date_trunc('month', now()))
                                AND course_id = ANY($1)
                          ) as revenue_this_month,
                          (
                              SELECT COALESCE(SUM(amount), 0) 
                              FROM takes 
                              WHERE timestamp >= extract(epoch from date_trunc('year', now()))
                                AND course_id = ANY($1)
                          ) as revenue_this_year,
                          COUNT(DISTINCT t.user_id) as total_paying_students,
                          COUNT(DISTINCT t.course_id) as courses_with_sales
                      FROM takes t
                      WHERE t.course_id = ANY($1)
                  `;
        params = [access.courseIds];
      } else if (access && !access.hasGlobalAccess && (!access.courseIds || access.courseIds.length === 0)) {
        return {
          success: true,
          data: [{
            total_revenue: 0,
            revenue_today: 0,
            revenue_this_month: 0,
            revenue_this_year: 0,
            total_paying_students: 0,
            courses_with_sales: 0
          }]
        };
      } else {
        query = `
                      SELECT 
                          COALESCE(SUM(t.amount), 0) as total_revenue,
                          (
                              SELECT COALESCE(SUM(amount), 0) 
                              FROM takes 
                              WHERE timestamp >= extract(epoch from date_trunc('day', now()))
                          ) as revenue_today,
                          (
                              SELECT COALESCE(SUM(amount), 0) 
                              FROM takes 
                              WHERE timestamp >= extract(epoch from date_trunc('month', now()))
                          ) as revenue_this_month,
                          (
                              SELECT COALESCE(SUM(amount), 0) 
                              FROM takes 
                              WHERE timestamp >= extract(epoch from date_trunc('year', now()))
                          ) as revenue_this_year,
                          COUNT(DISTINCT t.user_id) as total_paying_students,
                          COUNT(DISTINCT t.course_id) as courses_with_sales
                      FROM takes t
                  `;
      }

      const result = await this.query(query, params);

      if (courseId && result.success && result.data.length > 0) {
        const timeQuery = `
                    SELECT 
                        to_char(to_timestamp(timestamp), 'YYYY-MM') as month,
                        COALESCE(SUM(amount), 0) as revenue,
                        COUNT(DISTINCT user_id) as new_students
                    FROM takes
                    WHERE course_id = $1
                    GROUP BY month
                    ORDER BY month
                `;

        const timeResult = await this.query(timeQuery, [courseId]);
        if (timeResult.success) {
          result.data[0].monthly_data = timeResult.data;
        }
      }

      return result;
    } catch (error) {
      console.error("Error in getDetailedRevenue:", error);
      return { success: false, error: "Internal service error" };
    }
  };

  getRevenueByTimeframe = async (period = "year", access = null) => {
    let timeFrame;
    let groupFormat;

    switch (period) {
      case "week":
        timeFrame = `timestamp >= extract(epoch from (now() - interval '7 days'))`;
        groupFormat = "YYYY-MM-DD";
        break;
      case "month":
        timeFrame = `timestamp >= extract(epoch from (now() - interval '30 days'))`;
        groupFormat = "YYYY-MM-DD";
        break;
      case "year":
        timeFrame = `timestamp >= extract(epoch from (now() - interval '1 year'))`;
        groupFormat = "YYYY-MM";
        break;
      case "all":
      default:
        timeFrame = `timestamp > 0`;
        groupFormat = "YYYY-MM";
    }

    let query;
    let params = [];

    if (access && !access.hasGlobalAccess && access.courseIds && access.courseIds.length > 0) {
      query = `
              SELECT 
                  to_char(to_timestamp(timestamp), '${groupFormat}') as time_period,
                  COALESCE(SUM(amount), 0) as revenue,
                  COUNT(DISTINCT user_id) as new_students
              FROM takes
              WHERE ${timeFrame} AND course_id = ANY($1)
              GROUP BY time_period
              ORDER BY time_period
          `;
      params = [access.courseIds];
    } else if (access && !access.hasGlobalAccess && (!access.courseIds || access.courseIds.length === 0)) {
      return { success: true, data: [] };
    } else {
      query = `
              SELECT 
                  to_char(to_timestamp(timestamp), '${groupFormat}') as time_period,
                  COALESCE(SUM(amount), 0) as revenue,
                  COUNT(DISTINCT user_id) as new_students
              FROM takes
              WHERE ${timeFrame}
              GROUP BY time_period
              ORDER BY time_period
          `;
    }

    return this.query(query, params);
  };

  getTopRevenueGenerators = async (limit = 10, access = null) => {
    try {
      let query;
      let params;

      if (access && !access.hasGlobalAccess && access.courseIds && access.courseIds.length > 0) {
        query = `
              SELECT 
                c.id as course_id,
                c.title as course_name,
                COALESCE(SUM(t.amount), 0) as total_revenue,
                COUNT(DISTINCT t.user_id) as students,
                CASE 
                  WHEN COUNT(DISTINCT t.user_id) > 0 
                  THEN ROUND(CAST(SUM(t.amount) AS numeric) / COUNT(DISTINCT t.user_id), 2)
                  ELSE 0
                END as average_revenue_per_student,
                CASE 
                  WHEN c.enrolled > 0 
                  THEN ROUND(CAST(COUNT(DISTINCT t.user_id) * 100 AS numeric) / NULLIF(c.enrolled, 0), 2)
                  ELSE 0
                END as conversion_rate
              FROM course c
              LEFT JOIN takes t ON c.id = t.course_id
              WHERE c.id = ANY($1)
              GROUP BY c.id, c.title, c.enrolled
              ORDER BY total_revenue DESC
              LIMIT $2
            `;
        params = [access.courseIds, limit];
      } else if (access && !access.hasGlobalAccess && (!access.courseIds || access.courseIds.length === 0)) {
        return { success: true, data: [] };
      } else {
        query = `
              SELECT 
                c.id as course_id,
                c.title as course_name,
                COALESCE(SUM(t.amount), 0) as total_revenue,
                COUNT(DISTINCT t.user_id) as students,
                CASE 
                  WHEN COUNT(DISTINCT t.user_id) > 0 
                  THEN ROUND(CAST(SUM(t.amount) AS numeric) / COUNT(DISTINCT t.user_id), 2)
                  ELSE 0
                END as average_revenue_per_student,
                CASE 
                  WHEN c.enrolled > 0 
                  THEN ROUND(CAST(COUNT(DISTINCT t.user_id) * 100 AS numeric) / NULLIF(c.enrolled, 0), 2)
                  ELSE 0
                END as conversion_rate
              FROM course c
              LEFT JOIN takes t ON c.id = t.course_id
              GROUP BY c.id, c.title, c.enrolled
              ORDER BY total_revenue DESC
              LIMIT $1
            `;
        params = [limit];
      }

      return this.query(query, params);
    } catch (error) {
      console.error("Error in getTopRevenueGenerators:", error);
      return { success: false, error: error.toString() };
    }
  };
}

module.exports = { RevenueService };
