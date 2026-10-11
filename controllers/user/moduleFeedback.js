const Controller = require('../base').Controller;
const { respond, catchAs, handle } = require('../base');
const { ModuleFeedbackService } = require('../../service/moduleFeedback');

const moduleFeedbackService = new ModuleFeedbackService();

class ModuleFeedbackController extends Controller {
    constructor() {
        super();
    }

    /**
     * Submit or update module feedback
     * POST /user/module-feedback
     * Body: { moduleId, reaction, reason?, comment? }
     */
    submitFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { moduleId, reaction, reason, comment } = req.body;
        const userId = req.body.user_id;

        if (!moduleId || !reaction) {
            return res.status(400).json({
                success: false,
                error: 'moduleId and reaction are required'
            });
        }

        const result = await moduleFeedbackService.submitFeedback({
            moduleId: parseInt(moduleId),
            userId: parseInt(userId),
            reaction,
            reason,
            comment
        });

        return respond(res, result);
    });

    /**
     * Get user's feedback for a specific module
     * GET /user/module-feedback/:moduleId
     */
    getModuleFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { moduleId } = req.params;
        const userId = req.body.user_id;

        if (!moduleId) {
            return res.status(400).json({
                success: false,
                error: 'moduleId is required'
            });
        }

        const result = await moduleFeedbackService.getUserModuleFeedback(
            parseInt(moduleId),
            parseInt(userId)
        );

        return respond(res, result);
    });

    /**
     * Get user's feedback for all modules in a course
     * GET /user/module-feedback/course/:courseId
     */
    getCourseFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { courseId } = req.params;
        const userId = req.body.user_id;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                error: 'courseId is required'
            });
        }

        const result = await moduleFeedbackService.getUserCourseFeedback(
            parseInt(courseId),
            parseInt(userId)
        );

        return respond(res, result);
    });

    /**
     * Delete user's feedback for a module
     * DELETE /user/module-feedback/:moduleId
     */
    deleteFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { moduleId } = req.params;
        const userId = req.body.user_id;

        if (!moduleId) {
            return res.status(400).json({
                success: false,
                error: 'moduleId is required'
            });
        }

        const result = await moduleFeedbackService.deleteFeedback(
            parseInt(moduleId),
            parseInt(userId)
        );

        return res.status(result.success ? 200 : 404).json(result);
    });

    /**
     * Get module stats with user's reaction (for UI display)
     * GET /user/module-feedback/:moduleId/stats
     */
    getModuleStats = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { moduleId } = req.params;
        const userId = req.body.user_id;

        if (!moduleId) {
            return res.status(400).json({
                success: false,
                error: 'moduleId is required'
            });
        }

        const result = await moduleFeedbackService.getModuleStatsWithUserReaction(
            parseInt(moduleId),
            parseInt(userId)
        );

        return respond(res, result);
    });

    /**
     * Get available feedback reasons (active only)
     * GET /user/module-feedback/reasons
     */
    // Only active reasons
    getAvailableReasons = catchAs({ success: false, error: 'Internal server error' }, handle(() => moduleFeedbackService.getAllReasons(true)));
}

module.exports = {
    ModuleFeedbackController
};

