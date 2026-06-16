/**
 * Enhanced Teacher Controller V2
 */

const Controller = require('../base').Controller;
const TeacherServiceV2 = require('../../service/managerial/teacherV2').TeacherServiceV2;
const ErrorHandler = require('../../util/errorHandler');

const teacherServiceV2 = new TeacherServiceV2();

class TeacherControllerV2 extends Controller {
    constructor() {
        super();
    }

    /**
     * GET /v2/admin/teacher/list-names
     */
    listNames = async (req, res) => {
        try {
            const result = await teacherServiceV2.listNames();

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in listNames:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/teacher/list-full
     */
    listFull = async (req, res) => {
        try {
            const result = await teacherServiceV2.listFull();

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in listFull:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/teacher/{teacherId}/full
     */
    getTeacherFull = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.getTeacherFull(teacherId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getTeacherFull:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/teacher/by-course/{courseId}
     */
    getTeachersByCourse = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.getTeachersByCourse(courseId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'COURSE_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getTeachersByCourse:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/teacher/by-bundle/{bundleId}
     */
    getTeachersByBundle = async (req, res) => {
        try {
            const bundleId = parseInt(req.params.bundleId);
            if (isNaN(bundleId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    bundleId: 'Bundle ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.getTeachersByBundle(bundleId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'BUNDLE_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getTeachersByBundle:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * POST /v2/admin/teacher/create-enhanced
     */
    createEnhanced = async (req, res) => {
        try {
            const result = await teacherServiceV2.createEnhanced(req.body);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'DUPLICATE_LOGIN' ? 409 : 422
                );
                return res.status(statusCode).json(response);
            }

            return res.status(201).json(result);
        } catch (error) {
            console.error('Error in createEnhanced:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * PUT /v2/admin/teacher/{teacherId}/update-enhanced
     */
    updateEnhanced = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const updatedBy = req.user?.id ?? req.body.user_id;
            const result = await teacherServiceV2.updateEnhanced(teacherId, req.body, updatedBy);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'TEACHER_NOT_FOUND' ? 404 : 422
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in updateEnhanced:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * POST /v2/admin/teacher/{teacherId}/assign-course
     */
    assignToCourse = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            const { course_id } = req.body;

            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            if (!course_id || isNaN(parseInt(course_id))) {
                const { response, statusCode } = ErrorHandler.validationError({
                    course_id: 'Course ID is required and must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.assignToCourse(teacherId, parseInt(course_id));

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'TEACHER_NOT_FOUND' || result.code === 'COURSE_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in assignToCourse:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * DELETE /v2/admin/teacher/{teacherId}/course/{courseId}
     */
    removeFromCourse = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            const courseId = parseInt(req.params.courseId);

            if (isNaN(teacherId) || isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number',
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.removeFromCourse(teacherId, courseId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'ASSIGNMENT_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in removeFromCourse:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/teacher/{teacherId}/courses
     */
    getTeacherCourses = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.getTeacherCourses(teacherId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getTeacherCourses:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * POST /v2/admin/teacher/{teacherId}/assign-bundle
     */
    assignToBundle = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            const { bundle_id } = req.body;

            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            if (!bundle_id || isNaN(parseInt(bundle_id))) {
                const { response, statusCode } = ErrorHandler.validationError({
                    bundle_id: 'Bundle ID is required and must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.assignToBundle(teacherId, parseInt(bundle_id));

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'TEACHER_NOT_FOUND' || result.code === 'BUNDLE_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in assignToBundle:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * DELETE /v2/admin/teacher/{teacherId}/bundle/{bundleId}
     */
    removeFromBundle = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            const bundleId = parseInt(req.params.bundleId);

            if (isNaN(teacherId) || isNaN(bundleId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number',
                    bundleId: 'Bundle ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.removeFromBundle(teacherId, bundleId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'ASSIGNMENT_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in removeFromBundle:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/teacher/{teacherId}/bundles
     */
    getTeacherBundles = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.getTeacherBundles(teacherId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getTeacherBundles:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/teacher/search
     */
    searchTeachers = async (req, res) => {
        try {
            const filters = {
                q: req.query.q,
                category: req.query.category,
                isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
                isPrivileged: req.query.isPrivileged !== undefined ? req.query.isPrivileged === 'true' : undefined,
                hasCourses: req.query.hasCourses !== undefined ? req.query.hasCourses === 'true' : undefined,
                limit: req.query.limit,
                offset: req.query.offset
            };

            const result = await teacherServiceV2.searchTeachers(filters);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in searchTeachers:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * POST /v2/admin/teacher/{teacherId}/image
     */
    uploadImage = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const imageUrl = req.body.image_url;
            if (!imageUrl || typeof imageUrl !== 'string') {
                const { response, statusCode } = ErrorHandler.validationError({
                    image_url: 'image_url is required'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.updateTeacherImage(teacherId, imageUrl);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in uploadImage:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * DELETE /v2/admin/teacher/{teacherId}/image
     */
    deleteImage = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.deleteTeacherImage(teacherId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in deleteImage:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/teacher/{teacherId}/stats
     */
    getTeacherStats = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.getTeacherStats(teacherId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getTeacherStats:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * PUT /v2/admin/teacher/{teacherId}/toggle-active
     */
    toggleActive = async (req, res) => {
        try {
            const teacherId = parseInt(req.params.teacherId);
            const { isActive } = req.body;

            if (isNaN(teacherId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacherId: 'Teacher ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            if (typeof isActive !== 'boolean') {
                const { response, statusCode } = ErrorHandler.validationError({
                    isActive: 'isActive must be a boolean value'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.toggleActiveStatus(teacherId, isActive);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in toggleActive:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * POST /v2/admin/teacher/bulk-assign-course
     */
    bulkAssignToCourse = async (req, res) => {
        try {
            const { course_id, teacher_ids } = req.body;

            if (!course_id || isNaN(parseInt(course_id))) {
                const { response, statusCode } = ErrorHandler.validationError({
                    course_id: 'Course ID is required and must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            if (!Array.isArray(teacher_ids) || teacher_ids.length === 0) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacher_ids: 'teacher_ids must be a non-empty array'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.bulkAssignToCourse(parseInt(course_id), teacher_ids);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'COURSE_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in bulkAssignToCourse:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * POST /v2/admin/teacher/replace-course-instructors
     * Atomically replaces all instructor assignments for a course.
     */
    replaceInstructorsForCourse = async (req, res) => {
        try {
            const { course_id, teacher_ids } = req.body;

            if (!course_id || isNaN(parseInt(course_id))) {
                const { response, statusCode } = ErrorHandler.validationError({
                    course_id: 'Course ID is required and must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.replaceInstructorsForCourse(
                parseInt(course_id),
                Array.isArray(teacher_ids) ? teacher_ids : []
            );

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'COURSE_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in replaceInstructorsForCourse:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * POST /v2/admin/teacher/bulk-assign-bundle
     */
    bulkAssignToBundle = async (req, res) => {
        try {
            const { bundle_id, teacher_ids } = req.body;

            if (!bundle_id || isNaN(parseInt(bundle_id))) {
                const { response, statusCode } = ErrorHandler.validationError({
                    bundle_id: 'Bundle ID is required and must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            if (!Array.isArray(teacher_ids) || teacher_ids.length === 0) {
                const { response, statusCode } = ErrorHandler.validationError({
                    teacher_ids: 'teacher_ids must be a non-empty array'
                });
                return res.status(statusCode).json(response);
            }

            const result = await teacherServiceV2.bulkAssignToBundle(parseInt(bundle_id), teacher_ids);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'BUNDLE_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in bulkAssignToBundle:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };
}

module.exports = { TeacherControllerV2 };
