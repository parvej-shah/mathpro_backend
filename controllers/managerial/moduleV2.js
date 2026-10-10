/**
 * Enhanced Module Controller for Phase 8 (v2 APIs)
 */

const Controller = require('../base').Controller;
const ModuleServiceV2 = require('../../service/managerial/moduleV2').ModuleServiceV2;
const ErrorHandler = require('../../util/errorHandler');

const moduleServiceV2 = new ModuleServiceV2();

class ModuleControllerV2 extends Controller {
    constructor() {
        super();
    }

    /**
     * POST /v2/admin/module/{moduleId}/quiz/import
     */
    importQuiz = async (req, res) => {
        const moduleId = parseInt(req.params.moduleId);
        if (isNaN(moduleId)) {
            throw ErrorHandler.validationError({
                moduleId: 'Module ID must be a valid number'
            });
        }

        const { quiz_data } = req.body;

        if (!quiz_data) {
            throw ErrorHandler.validationError({
                quiz_data: 'Quiz data is required'
            });
        }

        const result = await moduleServiceV2.importQuiz(moduleId, quiz_data);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'MODULE_NOT_FOUND' ? 404 : 422
            );
        }

        return res.status(200).json(result);
    };

    /**
     * GET /v2/admin/module/{moduleId}/quiz/export
     */
    exportQuiz = async (req, res) => {
        const moduleId = parseInt(req.params.moduleId);
        if (isNaN(moduleId)) {
            throw ErrorHandler.validationError({
                moduleId: 'Module ID must be a valid number'
            });
        }

        const format = req.query.format || 'full';
        const includeAnswers = req.query.include_answers !== 'false';

        const result = await moduleServiceV2.exportQuiz(moduleId, format, includeAnswers);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'MODULE_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(200).json(result);
    };

    /**
     * PUT /v2/admin/module/{moduleId}/update-enhanced
     */
    updateEnhanced = async (req, res) => {
        const moduleId = parseInt(req.params.moduleId);
        if (isNaN(moduleId)) {
            throw ErrorHandler.validationError({
                moduleId: 'Module ID must be a valid number'
            });
        }

        const result = await moduleServiceV2.updateEnhanced(moduleId, req.body);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'MODULE_NOT_FOUND' || result.code === 'INSTRUCTOR_NOT_FOUND' ? 404 : 422
            );
        }

        return res.status(200).json(result);
    };

    /**
     * POST /v2/admin/module/{moduleId}/duplicate
     */
    duplicateModule = async (req, res) => {
        const moduleId = parseInt(req.params.moduleId);
        if (isNaN(moduleId)) {
            throw ErrorHandler.validationError({
                moduleId: 'Module ID must be a valid number'
            });
        }

        const includeContent = req.query.include_content !== 'false';
        const newChapterId = req.query.new_chapter_id ? parseInt(req.query.new_chapter_id) : null;

        if (newChapterId !== null && isNaN(newChapterId)) {
            throw ErrorHandler.validationError({
                new_chapter_id: 'Chapter ID must be a valid number'
            });
        }

        const result = await moduleServiceV2.duplicateModule(moduleId, includeContent, newChapterId);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                result.code === 'MODULE_NOT_FOUND' || result.code === 'CHAPTER_NOT_FOUND' ? 404 : 400
            );
        }

        return res.status(201).json(result);
    };

    /**
     * POST /v2/admin/modules/batch-update
     */
    batchUpdate = async (req, res) => {
        const { updates } = req.body;

        if (!updates || !Array.isArray(updates)) {
            throw ErrorHandler.validationError({
                updates: 'Updates must be a non-empty array'
            });
        }

        const result = await moduleServiceV2.batchUpdate(updates);

        if (!result.success) {
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                result.details,
                422
            );
        }

        return res.status(200).json(result);
    };
}

module.exports = { ModuleControllerV2 };
