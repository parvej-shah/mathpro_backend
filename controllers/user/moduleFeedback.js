const Controller = require('../base').Controller;
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
    submitFeedback = async (req, res) => {
        try {
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

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in submitFeedback:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Get user's feedback for a specific module
     * GET /user/module-feedback/:moduleId
     */
    getModuleFeedback = async (req, res) => {
        try {
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

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getModuleFeedback:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Get user's feedback for all modules in a course
     * GET /user/module-feedback/course/:courseId
     */
    getCourseFeedback = async (req, res) => {
        try {
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

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getCourseFeedback:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Delete user's feedback for a module
     * DELETE /user/module-feedback/:moduleId
     */
    deleteFeedback = async (req, res) => {
        try {
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
        } catch (error) {
            console.error('Error in deleteFeedback:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    /**
     * Get module stats with user's reaction (for UI display)
     * GET /user/module-feedback/:moduleId/stats
     */
    getModuleStats = async (req, res) => {
        try {
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
     * Get available feedback reasons (active only)
     * GET /user/module-feedback/reasons
     */
    getAvailableReasons = async (req, res) => {
        try {
            const result = await moduleFeedbackService.getAllReasons(true); // Only active reasons
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getAvailableReasons:', error);
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

