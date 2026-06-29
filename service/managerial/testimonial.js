const Service = require("../base").Service;
const { createTtlCache } = require("../../util/ttlCache");

const publicTestimonialCache = createTtlCache(15000);

class TestimonialService extends Service {
  getFeaturedQuery = () => `
    SELECT
      pt.feedback_id,
      pt.sort_order,
      pt.is_active,
      pt.created_at,
      pt.updated_at,
      f.course_id,
      f.user_id,
      f.rating,
      f.comment,
      f.category,
      f.created_at AS feedback_created_at,
      COALESCE(ma.name, ma.login, 'Anonymous') AS user_name,
      COALESCE(ma.email, '') AS user_email,
      COALESCE(c.title, '') AS course_name
    FROM public_testimonial pt
    INNER JOIN feedbacks f ON f.id = pt.feedback_id
    LEFT JOIN managerial_auth ma
      ON f.user_id ~ '^[0-9]+$'
     AND ma.id = f.user_id::integer
    LEFT JOIN course c
      ON f.course_id ~ '^[0-9]+$'
     AND c.id = f.course_id::integer
  `;

  listPublic = async () => {
    return publicTestimonialCache.getOrSet(async () => {
      return this.query(
        `${this.getFeaturedQuery()}
         WHERE pt.is_active = TRUE
           AND COALESCE(NULLIF(TRIM(f.comment), ''), '') <> ''
         ORDER BY pt.sort_order ASC, pt.feedback_id ASC`,
        []
      );
    });
  };

  listAdmin = async (access) => {
    const hasGlobalAccess = !access || access.hasGlobalAccess;
    const params = hasGlobalAccess ? [] : [access.courseIds.map(String)];
    const whereClause = hasGlobalAccess
      ? ""
      : "WHERE f.course_id = ANY($1)";

    return this.query(
      `${this.getFeaturedQuery()}
       ${whereClause}
       ORDER BY pt.sort_order ASC, pt.feedback_id ASC`,
      params
    );
  };

  getFeedbackWithCourse = async (feedbackId) => {
    return this.query(
      `SELECT f.*, c.title AS course_name
       FROM feedbacks f
       LEFT JOIN course c ON c.id::text = f.course_id
       WHERE f.id = $1`,
      [feedbackId]
    );
  };

  hasCourseAccess = (access, courseId) => {
    if (!access || access.hasGlobalAccess) return true;
    return access.courseIds.map(String).includes(String(courseId));
  };

  create = async (payload, access) => {
    const feedbackId = String(payload.feedback_id || "").trim();
    const sortOrder = Number.isFinite(Number(payload.sort_order))
      ? Math.trunc(Number(payload.sort_order))
      : 0;
    const isActive =
      payload.is_active === undefined ? true : Boolean(payload.is_active);

    if (!feedbackId) {
      return { success: false, error: "feedback_id is required" };
    }

    const feedback = await this.getFeedbackWithCourse(feedbackId);
    if (!feedback.success) return feedback;
    if (feedback.data.length === 0) {
      return { success: false, error: "Feedback not found" };
    }
    if (!String(feedback.data[0].comment || "").trim()) {
      return { success: false, error: "Feedback comment is required for testimonial" };
    }
    if (!this.hasCourseAccess(access, feedback.data[0].course_id)) {
      return { success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" };
    }

    return this.query(
      `INSERT INTO public_testimonial (feedback_id, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING feedback_id, sort_order, is_active, created_at, updated_at`,
      [feedbackId, sortOrder, isActive, Math.trunc(Date.now() / 1000)]
    );
  };

  update = async (feedbackId, payload, access) => {
    const featured = await this.getFeedbackWithCourse(feedbackId);
    if (!featured.success) return featured;
    if (featured.data.length === 0) {
      return { success: false, error: "Feedback not found" };
    }
    if (!this.hasCourseAccess(access, featured.data[0].course_id)) {
      return { success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" };
    }

    const current = await this.query(
      `SELECT feedback_id, sort_order, is_active FROM public_testimonial WHERE feedback_id = $1`,
      [feedbackId]
    );
    if (!current.success) return current;
    if (current.data.length === 0) {
      return { success: false, error: "Featured testimonial not found" };
    }

    const nextSortOrder =
      payload.sort_order === undefined
        ? current.data[0].sort_order
        : Math.trunc(Number(payload.sort_order) || 0);
    const nextIsActive =
      payload.is_active === undefined
        ? current.data[0].is_active
        : Boolean(payload.is_active);

    return this.query(
      `UPDATE public_testimonial
       SET sort_order = $1,
           is_active = $2,
           updated_at = $3
       WHERE feedback_id = $4
       RETURNING feedback_id, sort_order, is_active, created_at, updated_at`,
      [nextSortOrder, nextIsActive, Math.trunc(Date.now() / 1000), feedbackId]
    );
  };

  deleteEntry = async (feedbackId, access) => {
    const featured = await this.getFeedbackWithCourse(feedbackId);
    if (!featured.success) return featured;
    if (featured.data.length === 0) {
      return { success: false, error: "Feedback not found" };
    }
    if (!this.hasCourseAccess(access, featured.data[0].course_id)) {
      return { success: false, error: "NO_COURSE_ACCESS", message: "No access to this course" };
    }

    return this.query(
      `DELETE FROM public_testimonial WHERE feedback_id = $1 RETURNING feedback_id`,
      [feedbackId]
    );
  };
}

module.exports = { TestimonialService };
