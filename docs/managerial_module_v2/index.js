const moduleUpdateEnhanced = require('./module_update_enhanced');
const moduleQuizImport = require('./module_quiz_import');
const moduleQuizExport = require('./module_quiz_export');
const moduleDuplicate = require('./module_duplicate');

module.exports = {
  paths: {
    '/v2/admin/module/{moduleId}/update-enhanced': {
      put: moduleUpdateEnhanced,
    },
    '/v2/admin/module/{moduleId}/quiz/import': {
      post: moduleQuizImport,
    },
    '/v2/admin/module/{moduleId}/quiz/export': {
      get: moduleQuizExport,
    },
    '/v2/admin/module/{moduleId}/duplicate': {
      post: moduleDuplicate,
    },
  },
};
