/**
 * V2 Course Routes for Phase 8
 * All routes are prefixed with /v2/admin/course
 */

const router = require('express-promise-router')();
const CourseControllerV2 = require('../../controllers/managerial/courseV2').CourseControllerV2;
const { requirePermission, requireCourseAccess } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');

const requireCourseManage = requirePermission(PERMISSIONS.COURSE.MANAGE.ALL);
const requireCourseManageAccess = requireCourseAccess('course', 'manage', (req) => req.params.courseId);

const courseControllerV2 = new CourseControllerV2();

router.route('/')
    .get(requireCourseManage, courseControllerV2.list)
    .post(requireCourseManage, courseControllerV2.create);

router.route('/featured')
    .get(requireCourseManage, courseControllerV2.listFeatured)
    .post(requireCourseManage, courseControllerV2.createFeatured);

router.route('/featured/:courseId')
    .put(requireCourseManage, courseControllerV2.updateFeatured)
    .delete(requireCourseManage, courseControllerV2.deleteFeatured);

router.route('/:courseId')
    .get(requireCourseManage, courseControllerV2.getEntry)
    .put(requireCourseManageAccess, courseControllerV2.update)
    .delete(requireCourseManageAccess, courseControllerV2.deleteEntry);

router.route('/:courseId/full')
    .get(requireCourseManage, courseControllerV2.getFull)
    .put(requireCourseManageAccess, courseControllerV2.updateFull);

router.route('/:courseId/user-progress/:userId')
    .get(requireCourseManage, courseControllerV2.getUserProgress);

// Module Reordering
router.route('/:courseId/modules/reorder')
    .put(requireCourseManage, courseControllerV2.reorderModules);

// Enhanced Get Full
router.route('/:courseId/getFull-enhanced')
    .get(requireCourseManage, courseControllerV2.getFullEnhanced);

// Import Status
router.route('/import/:importId/status')
    .get(requireCourseManage, courseControllerV2.getImportStatus);

// Course Import
router.route('/import')
    .post(requireCourseManage, courseControllerV2.importCourse);

// Course Export - .own users can export their accessible courses
router.route('/:courseId/export')
    .get(requireCourseManage, courseControllerV2.exportCourse);

// Import Template
router.route('/import/template')
    .get(requireCourseManage, courseControllerV2.getImportTemplate);

module.exports = router;
