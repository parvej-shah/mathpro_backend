/**
 * V2 Teacher Routes
 * All routes are prefixed with /v2/admin/teacher
 * Phase 5: All routes require teacher.manage.all
 */

const router = require('express-promise-router')();
const TeacherControllerV2 = require('../../controllers/managerial/teacherV2').TeacherControllerV2;
const { requirePermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');
const { revalidateOnWrite } = require('../../util/revalidateFrontend');

const requireTeacherManage = requirePermission(PERMISSIONS.TEACHER.MANAGE.ALL);

const teacherControllerV2 = new TeacherControllerV2();

// A teacher write can change the instructors list and a course's instructors.
router.use(revalidateOnWrite(['instructors', 'courses']));

// Search teachers (must be before /:teacherId routes)
router.route('/search')
    .get(requireTeacherManage, teacherControllerV2.searchTeachers);

// Bulk operations (must be before /:teacherId routes)
router.route('/bulk-assign-course')
    .post(requireTeacherManage, teacherControllerV2.bulkAssignToCourse);

router.route('/replace-course-instructors')
    .post(requireTeacherManage, teacherControllerV2.replaceInstructorsForCourse);

// List teachers (names only)
router.route('/list-names')
    .get(requireTeacherManage, teacherControllerV2.listNames);

// List teachers (full info)
router.route('/list-full')
    .get(requireTeacherManage, teacherControllerV2.listFull);

// Get teachers by course
router.route('/by-course/:courseId')
    .get(requireTeacherManage, teacherControllerV2.getTeachersByCourse);

// Create teacher (enhanced)
router.route('/create-enhanced')
    .post(requireTeacherManage, teacherControllerV2.createEnhanced);

// Teacher-specific routes
router.route('/:teacherId/full')
    .get(requireTeacherManage, teacherControllerV2.getTeacherFull);

router.route('/:teacherId/update-enhanced')
    .put(requireTeacherManage, teacherControllerV2.updateEnhanced);

router.route('/:teacherId/stats')
    .get(requireTeacherManage, teacherControllerV2.getTeacherStats);

router.route('/:teacherId/toggle-active')
    .put(requireTeacherManage, teacherControllerV2.toggleActive);

router.route('/:teacherId/image')
    .post(requireTeacherManage, teacherControllerV2.uploadImage)
    .delete(requireTeacherManage, teacherControllerV2.deleteImage);

// Course associations
router.route('/:teacherId/assign-course')
    .post(requireTeacherManage, teacherControllerV2.assignToCourse);

router.route('/:teacherId/courses')
    .get(requireTeacherManage, teacherControllerV2.getTeacherCourses);

router.route('/:teacherId/course/:courseId')
    .delete(requireTeacherManage, teacherControllerV2.removeFromCourse);

module.exports = router;
