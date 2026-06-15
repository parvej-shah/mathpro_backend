const Controller = require('../base').Controller;
const { ModuleFeedbackService } = require('../../service/moduleFeedback');
const { getAccessibleCourseIds, checkCourseAccess, resolveCourseId } = require('../../util/courseAccessHelpers');

const moduleFeedbackService = new ModuleFeedbackService();

class ModuleFeedbackController extends Controller {
    constructor() {
        super();
    }

    /**
     * Get module feedback stats
     * GET /admin/module-feedback/stats/:moduleId
     */
    getModuleStats = async (req, res) => {
        try {
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
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }

            const result = await moduleFeedbackService.getModuleStats(parseInt(moduleId));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getModuleStats:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Get course feedback report
     * GET /admin/module-feedback/course/:courseId/report
     */
    getCourseReport = async (req, res) => {
        try {
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
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }

            const result = await moduleFeedbackService.getCourseReport(parseInt(courseId));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getCourseReport:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Get all feedback with filters
     * GET /admin/module-feedback
     * Query: { courseId?, moduleId?, reaction?, reason?, page?, limit? }
     */
    getAllFeedback = async (req, res) => {
        try {
            const { courseId, moduleId, reaction, reason, page, limit } = req.query;

            // Get accessible course IDs for filtering
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'feedback', 'manage');

            if (courseId) {
                const parsedCourseId = parseInt(courseId);
                if (isNaN(parsedCourseId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid course ID'
                    });
                }
                const courseAccess = await checkCourseAccess(userId, 'feedback', 'manage', parsedCourseId);
                if (!courseAccess.hasAccess) {
                    return res.status(403).json({
                        success: false,
                        error: 'NO_COURSE_ACCESS',
                        message: 'No access to this course'
                    });
                }
            }

            const result = await moduleFeedbackService.getAllFeedback({
                courseId: courseId ? parseInt(courseId) : null,
                moduleId: moduleId ? parseInt(moduleId) : null,
                reaction,
                reason,
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                access  // Pass access info to service
            });

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getAllFeedback:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Export feedback data as CSV
     * GET /admin/module-feedback/export
     * Query: { courseId?, reaction? }
     */
    exportFeedback = async (req, res) => {
        try {
            const { courseId, reaction } = req.query;

            // Get accessible course IDs for filtering
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'feedback', 'manage');

            if (courseId) {
                const parsedCourseId = parseInt(courseId);
                if (isNaN(parsedCourseId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid course ID'
                    });
                }
                const courseAccess = await checkCourseAccess(userId, 'feedback', 'manage', parsedCourseId);
                if (!courseAccess.hasAccess) {
                    return res.status(403).json({
                        success: false,
                        error: 'NO_COURSE_ACCESS',
                        message: 'No access to this course'
                    });
                }
            }

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
                    `"${(row.module_title || '').replace(/"/g, '""')}"`,
                    `"${(row.chapter_title || '').replace(/"/g, '""')}"`,
                    `"${(row.course_title || '').replace(/"/g, '""')}"`,
                    row.reaction,
                    row.reason || '',
                    `"${(row.comment || '').replace(/"/g, '""')}"`,
                    `"${(row.user_name || '').replace(/"/g, '""')}"`,
                    row.created_at
                ].join(','))
            ];

            return res.send(csvRows.join('\n'));
        } catch (error) {
            console.error('Error in exportFeedback:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    // ==================== FEEDBACK REASONS CRUD ====================

    /**
     * Get all feedback reasons
     * GET /admin/module-feedback/reasons
     * Query: { activeOnly? }
     */
    getAllReasons = async (req, res) => {
        try {
            const { activeOnly } = req.query;
            const result = await moduleFeedbackService.getAllReasons(activeOnly === 'true');
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getAllReasons:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Get a single reason by ID
     * GET /admin/module-feedback/reasons/:id
     */
    getReasonById = async (req, res) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Reason ID is required'
                });
            }

            const result = await moduleFeedbackService.getReasonById(parseInt(id));
            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Error in getReasonById:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Create a new feedback reason
     * POST /admin/module-feedback/reasons
     * Body: { reason_key, reason_label, description?, display_order?, is_active? }
     */
    createReason = async (req, res) => {
        try {
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
        } catch (error) {
            console.error('Error in createReason:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Update an existing feedback reason
     * PUT /admin/module-feedback/reasons/:id
     * Body: { reason_label?, description?, display_order?, is_active? }
     */
    updateReason = async (req, res) => {
        try {
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

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in updateReason:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Delete a feedback reason
     * DELETE /admin/module-feedback/reasons/:id
     */
    deleteReason = async (req, res) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Reason ID is required'
                });
            }

            const result = await moduleFeedbackService.deleteReason(parseInt(id));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in deleteReason:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Bulk update reason display orders
     * PATCH /admin/module-feedback/reasons/reorder
     * Body: { orders: [{ id, display_order }] }
     */
    updateReasonOrders = async (req, res) => {
        try {
            const { orders } = req.body;

            if (!orders || !Array.isArray(orders)) {
                return res.status(400).json({
                    success: false,
                    error: 'orders array is required'
                });
            }

            const result = await moduleFeedbackService.updateReasonOrders(orders);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in updateReasonOrders:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };
}

module.exports = {
    ModuleFeedbackController
};
