/**
 * V2 Module Routes for Phase 8
 * All routes are prefixed with /v2/admin/module
 */

const router = require('express-promise-router')();
const ModuleControllerV2 = require('../../controllers/managerial/moduleV2').ModuleControllerV2;
const { requirePermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');

// Phase 5: V2 module endpoints use course.manage.all (inherited from course)
const requireModuleManage = requirePermission(PERMISSIONS.MODULE.MANAGE.ALL);

const moduleControllerV2 = new ModuleControllerV2();

// Quiz Import/Export
router.route('/:moduleId/quiz/import')
    .post(requireModuleManage, moduleControllerV2.importQuiz);

router.route('/:moduleId/quiz/export')
    .get(requireModuleManage, moduleControllerV2.exportQuiz);

// Enhanced Module Update
router.route('/:moduleId/update-enhanced')
    .put(requireModuleManage, moduleControllerV2.updateEnhanced);

// Module Duplication
router.route('/:moduleId/duplicate')
    .post(requireModuleManage, moduleControllerV2.duplicateModule);

// Batch Operations
router.route('/batch-update')
    .post(requireModuleManage, moduleControllerV2.batchUpdate);

module.exports = router;
