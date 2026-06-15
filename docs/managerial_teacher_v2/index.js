const teacherListNames = require('./teacher_list_names');
const teacherListFull = require('./teacher_list_full');
const teacherGetFull = require('./teacher_get_full');
const teacherGetByCourse = require('./teacher_get_by_course');
const teacherGetByBundle = require('./teacher_get_by_bundle');
const teacherCreateEnhanced = require('./teacher_create_enhanced');
const teacherUpdateEnhanced = require('./teacher_update_enhanced');
const teacherAssignCourse = require('./teacher_assign_course');
const teacherRemoveCourse = require('./teacher_remove_course');
const teacherGetCourses = require('./teacher_get_courses');
const teacherAssignBundle = require('./teacher_assign_bundle');
const teacherRemoveBundle = require('./teacher_remove_bundle');
const teacherGetBundles = require('./teacher_get_bundles');
const teacherSearch = require('./teacher_search');
const teacherUploadImage = require('./teacher_upload_image');
const teacherDeleteImage = require('./teacher_delete_image');
const teacherStats = require('./teacher_stats');
const teacherToggleActive = require('./teacher_toggle_active');
const teacherBulkAssignCourse = require('./teacher_bulk_assign_course');
const teacherBulkAssignBundle = require('./teacher_bulk_assign_bundle');

module.exports = {
  paths: {
    '/v2/admin/teacher/list-names': {
      get: teacherListNames,
    },
    '/v2/admin/teacher/list-full': {
      get: teacherListFull,
    },
    '/v2/admin/teacher/{teacherId}/full': {
      get: teacherGetFull,
    },
    '/v2/admin/teacher/by-course/{courseId}': {
      get: teacherGetByCourse,
    },
    '/v2/admin/teacher/by-bundle/{bundleId}': {
      get: teacherGetByBundle,
    },
    '/v2/admin/teacher/create-enhanced': {
      post: teacherCreateEnhanced,
    },
    '/v2/admin/teacher/{teacherId}/update-enhanced': {
      put: teacherUpdateEnhanced,
    },
    '/v2/admin/teacher/{teacherId}/assign-course': {
      post: teacherAssignCourse,
    },
    '/v2/admin/teacher/{teacherId}/course/{courseId}': {
      delete: teacherRemoveCourse,
    },
    '/v2/admin/teacher/{teacherId}/courses': {
      get: teacherGetCourses,
    },
    '/v2/admin/teacher/{teacherId}/assign-bundle': {
      post: teacherAssignBundle,
    },
    '/v2/admin/teacher/{teacherId}/bundle/{bundleId}': {
      delete: teacherRemoveBundle,
    },
    '/v2/admin/teacher/{teacherId}/bundles': {
      get: teacherGetBundles,
    },
    '/v2/admin/teacher/search': {
      get: teacherSearch,
    },
    '/v2/admin/teacher/{teacherId}/image': {
      post: teacherUploadImage,
      delete: teacherDeleteImage,
    },
    '/v2/admin/teacher/{teacherId}/stats': {
      get: teacherStats,
    },
    '/v2/admin/teacher/{teacherId}/toggle-active': {
      put: teacherToggleActive,
    },
    '/v2/admin/teacher/bulk-assign-course': {
      post: teacherBulkAssignCourse,
    },
    '/v2/admin/teacher/bulk-assign-bundle': {
      post: teacherBulkAssignBundle,
    },
  },
};
