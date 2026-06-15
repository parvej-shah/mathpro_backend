const courseList = require('./course_list');
const courseCreate = require('./course_create');
const courseGet = require('./course_get');
const courseUpdate = require('./course_update');
const courseDelete = require('./course_delete');
const courseGetFull = require('./course_getfull');
const courseUpdateFull = require('./course_updatefull');
const courseUserProgress = require('./course_user_progress');
const courseGetFullEnhanced = require('./course_getfull_enhanced');
const courseModulesReorder = require('./course_modules_reorder');
const courseExport = require('./course_export');
const courseImport = require('./course_import');
const courseImportStatus = require('./course_import_status');
const courseImportTemplate = require('./course_import_template');

module.exports = {
  paths: {
    '/v2/admin/course': {
      get: courseList,
      post: courseCreate,
    },
    '/v2/admin/course/{courseId}': {
      get: courseGet,
      put: courseUpdate,
      delete: courseDelete,
    },
    '/v2/admin/course/{courseId}/full': {
      get: courseGetFull,
      put: courseUpdateFull,
    },
    '/v2/admin/course/{courseId}/user-progress/{userId}': {
      get: courseUserProgress,
    },
    '/v2/admin/course/{courseId}/getFull-enhanced': {
      get: courseGetFullEnhanced,
    },
    '/v2/admin/course/{courseId}/modules/reorder': {
      put: courseModulesReorder,
    },
    '/v2/admin/course/{courseId}/export': {
      get: courseExport,
    },
    '/v2/admin/course/import': {
      post: courseImport,
    },
    '/v2/admin/course/import/{importId}/status': {
      get: courseImportStatus,
    },
    '/v2/admin/course/import/template': {
      get: courseImportTemplate,
    },
  },
};
