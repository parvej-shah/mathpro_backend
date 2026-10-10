// Shared by the analytics V2 services: course-scope access helpers for restricted admins.
// Part of AnalyticsV2Service (../analyticsV2Service.js), which callers use.
const Service = require("../../../base").Service;

class AnalyticsV2Base extends Service {
  constructor() {
    super();
  }

  _isRestrictedAccess = (access) => {
    return !!(access && access.hasGlobalAccess === false);
  };

  _getAccessibleCourseIds = (access) => {
    if (!this._isRestrictedAccess(access)) {
      return [];
    }
    return Array.isArray(access.courseIds) ? access.courseIds : [];
  };

  _hasNoAccessibleCourses = (access) => {
    return this._isRestrictedAccess(access) && this._getAccessibleCourseIds(access).length === 0;
  };

  _appendCourseAccessCondition = (columnName, params, access) => {
    if (!this._isRestrictedAccess(access)) {
      return "";
    }

    const courseIds = this._getAccessibleCourseIds(access);
    if (courseIds.length === 0) {
      return " AND 1 = 0";
    }

    params.push(courseIds);
    return ` AND ${columnName} = ANY($${params.length})`;
  };

  _appendBundleAccessCondition = (bundleIdColumn, params, access) => {
    if (!this._isRestrictedAccess(access)) {
      return "";
    }

    const courseIds = this._getAccessibleCourseIds(access);
    if (courseIds.length === 0) {
      return " AND 1 = 0";
    }

    params.push(courseIds);
    return ` AND EXISTS (
      SELECT 1
      FROM bundle_course bac
      WHERE bac.bundle_id = ${bundleIdColumn}
        AND bac.course_id = ANY($${params.length})
    )`;
  };

  // ── Dashboard time-series helpers ─────────────────────────────────────────
  // Used by the centralized dashboard overview / timeseries endpoints to return
  // real { period, revenue, enrollments, users } curves (not just scalars).
}

module.exports = { AnalyticsV2Base };
