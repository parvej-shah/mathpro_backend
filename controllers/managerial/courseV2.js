/**
 * Enhanced Course Controller for Phase 8 (v2 APIs)
 */

const Controller = require('../base').Controller;
const CourseServiceV2 = require('../../service/managerial/courseV2').CourseServiceV2;
const CourseImportExportService = require('../../service/managerial/courseImportExport').CourseImportExportService;
const FeaturedCourseService = require('../../service/managerial/featuredCourse').FeaturedCourseService;
const ErrorHandler = require('../../util/errorHandler');
const path = require('path');

const courseServiceV2 = new CourseServiceV2();
const importExportService = new CourseImportExportService();
const featuredCourseService = new FeaturedCourseService();

class CourseControllerV2 extends Controller {
    constructor() {
        super();
    }

    list = async (req, res) => {
        try {
            const userId = req.user ? req.user.id : null;
            const { getAccessibleCourseIds } = require('../../util/courseAccessHelpers');
            const access = userId ? await getAccessibleCourseIds(userId, 'course', 'manage') : null;
            const result = await courseServiceV2.list(req, access);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in list:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    listFeatured = async (req, res) => {
        try {
            const result = await featuredCourseService.listAdmin();
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in listFeatured:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    createFeatured = async (req, res) => {
        try {
            const result = await featuredCourseService.create(req.body);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in createFeatured:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    updateFeatured = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await featuredCourseService.update(courseId, req.body);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in updateFeatured:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    deleteFeatured = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await featuredCourseService.deleteEntry(courseId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in deleteFeatured:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    create = async (req, res) => {
        try {
            const result = await courseServiceV2.create(req.body);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in create:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    update = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await courseServiceV2.update(courseId, req.body);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in update:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    updateFull = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await courseServiceV2.updateFull(courseId, req.body);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in updateFull:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    getEntry = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const { checkCourseAccess } = require('../../util/courseAccessHelpers');
            const access = await checkCourseAccess(req.user.id, 'course', 'manage', courseId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }

            const result = await courseServiceV2.get(courseId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getEntry:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    getFull = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const { checkCourseAccess } = require('../../util/courseAccessHelpers');
            const access = await checkCourseAccess(req.user.id, 'course', 'manage', courseId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }

            const result = await courseServiceV2.getFull(courseId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getFull:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    deleteEntry = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            const result = await courseServiceV2.deleteEntry(courseId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in deleteEntry:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    getUserProgress = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            const userId = parseInt(req.params.userId);

            if (isNaN(courseId) || isNaN(userId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: isNaN(courseId) ? 'Course ID must be a valid number' : undefined,
                    userId: isNaN(userId) ? 'User ID must be a valid number' : undefined,
                });
                return res.status(statusCode).json(response);
            }

            const { checkCourseAccess } = require('../../util/courseAccessHelpers');
            const access = await checkCourseAccess(req.user.id, 'course', 'manage', courseId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }

            const result = await courseServiceV2.getUserProgress(userId, courseId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getUserProgress:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * PUT /v2/admin/course/{courseId}/modules/reorder
     */
    reorderModules = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            // Check course access for .own permission users
            const { checkCourseAccess } = require('../../util/courseAccessHelpers');
            const access = await checkCourseAccess(req.user.id, 'course', 'manage', courseId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }

            const { module_orders } = req.body;

            if (!module_orders || !Array.isArray(module_orders)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    module_orders: 'Module orders must be a non-empty array'
                });
                return res.status(statusCode).json(response);
            }

            const result = await courseServiceV2.reorderModules(courseId, module_orders);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    result.details,
                    result.code === 'COURSE_NOT_FOUND' ? 404 : 422
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in reorderModules:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/course/{courseId}/getFull-enhanced
     */
    getFullEnhanced = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            // Check course access for .own permission users
            const { checkCourseAccess } = require('../../util/courseAccessHelpers');
            const access = await checkCourseAccess(req.user.id, 'course', 'manage', courseId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }

            const result = await courseServiceV2.getFullEnhanced(courseId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error || 'Course not found',
                    result.code || 'COURSE_NOT_FOUND',
                    null,
                    404
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getFullEnhanced:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/course/import/{importId}/status
     */
    getImportStatus = async (req, res) => {
        try {
            const { importId } = req.params;

            if (!importId) {
                const { response, statusCode } = ErrorHandler.validationError({
                    importId: 'Import ID is required'
                });
                return res.status(statusCode).json(response);
            }

            const result = await courseServiceV2.getImportTracking(importId);

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    null,
                    result.code === 'IMPORT_NOT_FOUND' ? 404 : 400
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getImportStatus:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * POST /v2/admin/course/import
     */
    importCourse = async (req, res) => {
        try {
            const { upload_key: uploadKey } = req.body;
            if (!uploadKey || typeof uploadKey !== 'string') {
                const { response, statusCode } = ErrorHandler.validationError({
                    upload_key: 'upload_key is required'
                });
                return res.status(statusCode).json(response);
            }

            const format = req.body.format || path.extname(uploadKey).substring(1).toLowerCase();
            if (format !== 'csv' && format !== 'json') {
                const { response, statusCode } = ErrorHandler.validationError({
                    format: 'Format must be "csv" or "json"'
                });
                return res.status(statusCode).json(response);
            }

            const importMode = req.body.import_mode || 'create';
            if (!['create', 'update', 'upsert'].includes(importMode)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    import_mode: 'Import mode must be "create", "update", or "upsert"'
                });
                return res.status(statusCode).json(response);
            }

            const validateOnly = req.body.validate_only === 'true' || req.body.validate_only === true;
            const createdBy = req.body.user_id;

            const result = await importExportService.importCourse(
                uploadKey,
                format,
                importMode,
                createdBy,
                validateOnly
            );

            if (!result.success) {
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    null,
                    422
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in importCourse:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/course/{courseId}/export
     */
    exportCourse = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            if (isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    courseId: 'Course ID must be a valid number'
                });
                return res.status(statusCode).json(response);
            }

            // Check course access for .own permission users
            const { checkCourseAccess } = require('../../util/courseAccessHelpers');
            const access = await checkCourseAccess(req.user.id, 'course', 'manage', courseId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }

            const format = req.query.format || 'json';
            const includeContent = req.query.include_content !== 'false';
            const includeQuizAnswers = req.query.include_quiz_answers === 'true';

            if (format === 'json') {
                const result = await importExportService.exportCourseJSON(
                    courseId,
                    includeContent,
                    includeQuizAnswers
                );

                if (!result.success) {
                    const { response, statusCode } = ErrorHandler.createErrorResponse(
                        result.error,
                        result.code,
                        null,
                        result.code === 'COURSE_NOT_FOUND' ? 404 : 400
                    );
                    return res.status(statusCode).json(response);
                }

                return res.status(200).json(result);
            } else {
                // CSV export would go here
                return res.status(400).json({
                    success: false,
                    error: 'CSV export not yet implemented',
                    code: 'NOT_IMPLEMENTED'
                });
            }
        } catch (error) {
            console.error('Error in exportCourse:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };

    /**
     * GET /v2/admin/course/import/template
     */
    getImportTemplate = async (req, res) => {
        try {
            const format = req.query.format || 'csv';
            const exampleData = req.query.example_data !== 'false';

            if (format === 'json') {
                const template = {
                    version: '1.0',
                    format_version: '1.0',
                    course: {
                        title: 'Example Course',
                        description: 'Course description',
                        language: 'English',
                        price: 5000,
                        x_price: 8000
                    },
                    chapters: [
                        {
                            serial: 1,
                            title: 'Chapter 1',
                            is_free: false,
                            is_live: true,
                            modules: [
                                {
                                    serial: 1,
                                    title: 'Module 1',
                                    category: 'VIDEO',
                                    score: 10,
                                    is_live: true,
                                    is_free: false,
                                    description: 'Module description',
                                    data: {
                                        category: 'VIDEO',
                                        videoUrl: 'https://youtube.com/watch?v=...',
                                        videoHost: 'Youtube'
                                    }
                                }
                            ]
                        }
                    ]
                };

                return res.status(200).json({
                    success: true,
                    data: exampleData ? template : { version: '1.0', format_version: '1.0', course: {}, chapters: [] }
                });
            } else {
                // CSV template
                const csvHeaders = [
                    'course_title', 'course_description', 'course_language', 'course_price', 'course_x_price',
                    'chapter_serial', 'chapter_title', 'chapter_is_free', 'chapter_is_live',
                    'module_serial', 'module_title', 'module_category', 'module_score',
                    'module_is_live', 'module_is_free', 'module_description'
                ].join(',');

                if (exampleData) {
                    const exampleRow = [
                        'Example Course', 'Course description', 'English', '5000', '8000',
                        '1', 'Chapter 1', 'false', 'true',
                        '1', 'Module 1', 'VIDEO', '10',
                        'true', 'false', 'Module description'
                    ].join(',');

                    res.setHeader('Content-Type', 'text/csv');
                    res.setHeader('Content-Disposition', 'attachment; filename="course_import_template.csv"');
                    return res.status(200).send(`${csvHeaders}\n${exampleRow}\n`);
                } else {
                    res.setHeader('Content-Type', 'text/csv');
                    res.setHeader('Content-Disposition', 'attachment; filename="course_import_template.csv"');
                    return res.status(200).send(`${csvHeaders}\n`);
                }
            }
        } catch (error) {
            console.error('Error in getImportTemplate:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };
}

module.exports = { CourseControllerV2 };
