const Controller = require('../base').Controller;
const { respond, catchAs } = require('../base');
const { parsePagination } = require('../../util/pagination');
const { ModuleFeedbackService } = require('../../service/moduleFeedback');
const { getAccessibleCourseIds, checkCourseAccess, resolveCourseId } = require('../../util/courseAccessHelpers');
const { noCourseAccess, rejectCourseFilter } = require('../shared/courseAccess');
const { csvText } = require('../../util/csv');

const moduleFeedbackService = new ModuleFeedbackService();

class ModuleFeedbackController extends Controller {
    constructor() {
        super();
    }

    /**
     * Get module feedback stats
     * GET /admin/module-feedback/stats/:moduleId
     */
    getModuleStats = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { moduleId } = req.params;

        if (!moduleId) {
            return res.status(400).json({
                success: false,
                error: 'moduleId is required'
            });
        }

        // Check access to the module's course
        const userId = req.user.id;
        const courseId = await resolveCourseId('module', parseInt(moduleId));
        if (!courseId) {
            return res.status(404).json({
                success: false,
                error: 'Module not found'
            });
        }

        const access = await checkCourseAccess(userId, 'feedback', 'manage', courseId);
        if (!access.hasAccess) return noCourseAccess(res);

        const result = await moduleFeedbackService.getModuleStats(parseInt(moduleId));
        return respond(res, result);
    });

    /**
     * Get course feedback report
     * GET /admin/module-feedback/course/:courseId/report
     */
    getCourseReport = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { courseId } = req.params;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                error: 'courseId is required'
            });
        }

        // Check access to the course
        const userId = req.user.id;
        const access = await checkCourseAccess(userId, 'feedback', 'manage', parseInt(courseId));
        if (!access.hasAccess) return noCourseAccess(res);

        const result = await moduleFeedbackService.getCourseReport(parseInt(courseId));
        return respond(res, result);
    });

    /**
     * Get all feedback with filters
     * GET /admin/module-feedback
     * Query: { courseId?, moduleId?, reaction?, reason?, page?, limit? }
     */
    getAllFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { courseId, moduleId, reaction, reason } = req.query;
        const { page, limit } = parsePagination(req.query, { defaultLimit: 20 });

        // Get accessible course IDs for filtering
        const userId = req.user.id;
        const access = await getAccessibleCourseIds(userId, 'feedback', 'manage');

        const rejected = await rejectCourseFilter(res, userId, courseId, 'feedback', 'manage');
        if (rejected) return rejected;

        const result = await moduleFeedbackService.getAllFeedback({
            courseId: courseId ? parseInt(courseId) : null,
            moduleId: moduleId ? parseInt(moduleId) : null,
            reaction,
            reason,
            page,
            limit,
            access  // Pass access info to service
        });

        return respond(res, result);
    });

    /**
     * Export feedback data as CSV
     * GET /admin/module-feedback/export
     * Query: { courseId?, reaction? }
     */
    exportFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { courseId, reaction } = req.query;

        // Get accessible course IDs for filtering
        const userId = req.user.id;
        const access = await getAccessibleCourseIds(userId, 'feedback', 'manage');

        const rejected = await rejectCourseFilter(res, userId, courseId, 'feedback', 'manage');
        if (rejected) return rejected;

        const result = await moduleFeedbackService.getAllFeedback({
            courseId: courseId ? parseInt(courseId) : null,
            reaction,
            page: 1,
            limit: 10000, // Get all for export
            access  // Pass access info to service
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        if (result.data.length === 0) {
            return res.status(200).send('No feedback data found');
        }

        // Set CSV headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=module_feedback_${Date.now()}.csv`);

        // Create CSV
        const headers = [
            'Module ID', 'Module Title', 'Chapter Title', 'Course Title',
            'Reaction', 'Reason', 'Comment', 'User Name', 'Created At'
        ];
        
        const csvRows = [
            headers.join(','),
            ...result.data.map(row => [
                row.module_id,
                csvText(row.module_title),
                csvText(row.chapter_title),
                csvText(row.course_title),
                row.reaction,
                row.reason || '',
                csvText(row.comment),
                csvText(row.user_name),
                row.created_at
            ].join(','))
        ];

        return res.send(csvRows.join('\n'));
    });

    // ==================== FEEDBACK REASONS CRUD ====================

    /**
     * Get all feedback reasons
     * GET /admin/module-feedback/reasons
     * Query: { activeOnly? }
     */
    getAllReasons = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { activeOnly } = req.query;
        const result = await moduleFeedbackService.getAllReasons(activeOnly === 'true');
        return respond(res, result);
    });

    /**
     * Get a single reason by ID
     * GET /admin/module-feedback/reasons/:id
     */
    getReasonById = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Reason ID is required'
            });
        }

        const result = await moduleFeedbackService.getReasonById(parseInt(id));
        return res.status(result.success ? 200 : 404).json(result);
    });

    /**
     * Create a new feedback reason
     * POST /admin/module-feedback/reasons
     * Body: { reason_key, reason_label, description?, display_order?, is_active? }
     */
    createReason = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { reason_key, reason_label, description, display_order, is_active } = req.body;

        if (!reason_key || !reason_label) {
            return res.status(400).json({
                success: false,
                error: 'reason_key and reason_label are required'
            });
        }

        const result = await moduleFeedbackService.createReason({
            reason_key,
            reason_label,
            description,
            display_order,
            is_active
        });

        return res.status(result.success ? 201 : 400).json(result);
    });

    /**
     * Update an existing feedback reason
     * PUT /admin/module-feedback/reasons/:id
     * Body: { reason_label?, description?, display_order?, is_active? }
     */
    updateReason = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { id } = req.params;
        const { reason_label, description, display_order, is_active } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Reason ID is required'
            });
        }

        const result = await moduleFeedbackService.updateReason(parseInt(id), {
            reason_label,
            description,
            display_order,
            is_active
        });

        return respond(res, result);
    });

    /**
     * Delete a feedback reason
     * DELETE /admin/module-feedback/reasons/:id
     */
    deleteReason = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Reason ID is required'
            });
        }

        const result = await moduleFeedbackService.deleteReason(parseInt(id));
        return respond(res, result);
    });

    /**
     * Bulk update reason display orders
     * PATCH /admin/module-feedback/reasons/reorder
     * Body: { orders: [{ id, display_order }] }
     */
    updateReasonOrders = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { orders } = req.body;

        if (!orders || !Array.isArray(orders)) {
            return res.status(400).json({
                success: false,
                error: 'orders array is required'
            });
        }

        const result = await moduleFeedbackService.updateReasonOrders(orders);
        return respond(res, result);
    });
}

module.exports = {
    ModuleFeedbackController
};
