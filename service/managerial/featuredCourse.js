const Service = require("../base").Service;

class FeaturedCourseService extends Service {
  getAdminQuery = () => `
    SELECT
      pfc.course_id,
      pfc.sort_order,
      pfc.is_active,
      pfc.created_at,
      pfc.updated_at,
      c.*
    FROM public_featured_course pfc
    INNER JOIN course c ON c.id = pfc.course_id
  `;

  listPublic = async () => {
    return this.query(
      `SELECT c.*
       FROM public_featured_course pfc
       INNER JOIN course c ON c.id = pfc.course_id
       WHERE pfc.is_active = TRUE
         AND c.is_live = TRUE
       ORDER BY pfc.sort_order ASC, pfc.course_id ASC`,
      []
    );
  };

  listAdmin = async () => {
    return this.query(
      `${this.getAdminQuery()}
       ORDER BY pfc.sort_order ASC, pfc.course_id ASC`,
      []
    );
  };

  getCourse = async (courseId) => {
    return this.query(
      `SELECT id, title, is_live
       FROM course
       WHERE id = $1`,
      [courseId]
    );
  };

  create = async (payload) => {
    const courseId = Number.parseInt(String(payload.course_id), 10);
    const sortOrder = Number.isFinite(Number(payload.sort_order))
      ? Math.trunc(Number(payload.sort_order))
      : 0;
    const isActive =
      payload.is_active === undefined ? true : Boolean(payload.is_active);

    if (Number.isNaN(courseId)) {
      return { success: false, error: "course_id is required" };
    }

    const course = await this.getCourse(courseId);
    if (!course.success) return course;
    if (course.data.length === 0) {
      return { success: false, error: "Course not found" };
    }

    return this.query(
      `INSERT INTO public_featured_course (course_id, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING course_id, sort_order, is_active, created_at, updated_at`,
      [courseId, sortOrder, isActive, Math.trunc(Date.now() / 1000)]
    );
  };

  update = async (courseId, payload) => {
    const normalizedCourseId = Number.parseInt(String(courseId), 10);
    if (Number.isNaN(normalizedCourseId)) {
      return { success: false, error: "course_id is required" };
    }

    const current = await this.query(
      `SELECT course_id, sort_order, is_active
       FROM public_featured_course
       WHERE course_id = $1`,
      [normalizedCourseId]
    );
    if (!current.success) return current;
    if (current.data.length === 0) {
      return { success: false, error: "Featured course not found" };
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
      `UPDATE public_featured_course
       SET sort_order = $1,
           is_active = $2,
           updated_at = $3
       WHERE course_id = $4
       RETURNING course_id, sort_order, is_active, created_at, updated_at`,
      [nextSortOrder, nextIsActive, Math.trunc(Date.now() / 1000), normalizedCourseId]
    );
  };

  deleteEntry = async (courseId) => {
    const normalizedCourseId = Number.parseInt(String(courseId), 10);
    if (Number.isNaN(normalizedCourseId)) {
      return { success: false, error: "course_id is required" };
    }

    return this.query(
      `DELETE FROM public_featured_course
       WHERE course_id = $1
       RETURNING course_id`,
      [normalizedCourseId]
    );
  };
}

module.exports = { FeaturedCourseService };
