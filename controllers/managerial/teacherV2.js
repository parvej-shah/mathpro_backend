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
        const result = await teacherServiceV2.listNames();

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * GET /v2/admin/teacher/list-full
     */
    listFull = async (req, res) => {
        const result = await teacherServiceV2.listFull();

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * GET /v2/admin/teacher/{teacherId}/full
     */
    getTeacherFull = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        if (isNaN(teacherId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number'
            });
        }

        const result = await teacherServiceV2.getTeacherFull(teacherId);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * GET /v2/admin/teacher/by-course/{courseId}
     */
    getTeachersByCourse = async (req, res) => {
        const courseId = parseInt(req.params.courseId);
        if (isNaN(courseId)) {
            throw ErrorHandler.validationError({
                courseId: 'Course ID must be a valid number'
            });
        }

        const result = await teacherServiceV2.getTeachersByCourse(courseId);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'COURSE_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * POST /v2/admin/teacher/create-enhanced
     */
    createEnhanced = async (req, res) => {
        const result = await teacherServiceV2.createEnhanced(req.body);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'DUPLICATE_LOGIN' ? 409 : 422
            );
        }

        return res.status(201).json(result);
    };

    /**
     * PUT /v2/admin/teacher/{teacherId}/update-enhanced
     */
    updateEnhanced = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        if (isNaN(teacherId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number'
            });
        }

        const updatedBy = req.user?.id ?? req.body.user_id;
        const result = await teacherServiceV2.updateEnhanced(teacherId, req.body, updatedBy);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'TEACHER_NOT_FOUND' ? 404 : 422
            );
        }

        return res.status(200).json(result);
    };

    /**
     * POST /v2/admin/teacher/{teacherId}/assign-course
     */
    assignToCourse = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        const { course_id } = req.body;

        if (isNaN(teacherId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number'
            });
        }

        if (!course_id || isNaN(parseInt(course_id))) {
            throw ErrorHandler.validationError({
                course_id: 'Course ID is required and must be a valid number'
            });
        }

        const result = await teacherServiceV2.assignToCourse(teacherId, parseInt(course_id));

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'TEACHER_NOT_FOUND' || result.code === 'COURSE_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * DELETE /v2/admin/teacher/{teacherId}/course/{courseId}
     */
    removeFromCourse = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        const courseId = parseInt(req.params.courseId);

        if (isNaN(teacherId) || isNaN(courseId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number',
                courseId: 'Course ID must be a valid number'
            });
        }

        const result = await teacherServiceV2.removeFromCourse(teacherId, courseId);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'ASSIGNMENT_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * GET /v2/admin/teacher/{teacherId}/courses
     */
    getTeacherCourses = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        if (isNaN(teacherId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number'
            });
        }

        const result = await teacherServiceV2.getTeacherCourses(teacherId);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * GET /v2/admin/teacher/search
     */
    searchTeachers = async (req, res) => {
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
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * POST /v2/admin/teacher/{teacherId}/image
     */
    uploadImage = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        if (isNaN(teacherId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number'
            });
        }

        const imageUrl = req.body.image_url;
        if (!imageUrl || typeof imageUrl !== 'string') {
            throw ErrorHandler.validationError({
                image_url: 'image_url is required'
            });
        }

        const result = await teacherServiceV2.updateTeacherImage(teacherId, imageUrl);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * DELETE /v2/admin/teacher/{teacherId}/image
     */
    deleteImage = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        if (isNaN(teacherId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number'
            });
        }

        const result = await teacherServiceV2.deleteTeacherImage(teacherId);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * GET /v2/admin/teacher/{teacherId}/stats
     */
    getTeacherStats = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        if (isNaN(teacherId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number'
            });
        }

        const result = await teacherServiceV2.getTeacherStats(teacherId);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * PUT /v2/admin/teacher/{teacherId}/toggle-active
     */
    toggleActive = async (req, res) => {
        const teacherId = parseInt(req.params.teacherId);
        const { isActive } = req.body;

        if (isNaN(teacherId)) {
            throw ErrorHandler.validationError({
                teacherId: 'Teacher ID must be a valid number'
            });
        }

        if (typeof isActive !== 'boolean') {
            throw ErrorHandler.validationError({
                isActive: 'isActive must be a boolean value'
            });
        }

        const result = await teacherServiceV2.toggleActiveStatus(teacherId, isActive);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'TEACHER_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * POST /v2/admin/teacher/bulk-assign-course
     */
    bulkAssignToCourse = async (req, res) => {
        const { course_id, teacher_ids } = req.body;

        if (!course_id || isNaN(parseInt(course_id))) {
            throw ErrorHandler.validationError({
                course_id: 'Course ID is required and must be a valid number'
            });
        }

        if (!Array.isArray(teacher_ids) || teacher_ids.length === 0) {
            throw ErrorHandler.validationError({
                teacher_ids: 'teacher_ids must be a non-empty array'
            });
        }

        const result = await teacherServiceV2.bulkAssignToCourse(parseInt(course_id), teacher_ids);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'COURSE_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * POST /v2/admin/teacher/replace-course-instructors
     * Atomically replaces all instructor assignments for a course.
     */
    replaceInstructorsForCourse = async (req, res) => {
        const { course_id, teacher_ids } = req.body;

        if (!course_id || isNaN(parseInt(course_id))) {
            throw ErrorHandler.validationError({
                course_id: 'Course ID is required and must be a valid number'
            });
        }

        const result = await teacherServiceV2.replaceInstructorsForCourse(
            parseInt(course_id),
            Array.isArray(teacher_ids) ? teacher_ids : []
        );

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'COURSE_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

}

module.exports = { TeacherControllerV2 };
