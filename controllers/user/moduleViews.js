const Controller = require("../base").Controller;
const { ModuleViewsService } = require("../../service/user/moduleViews");

const moduleViewsService = new ModuleViewsService();

class ModuleViewsController extends Controller {
    constructor() {
        super();
    }

    /**
     * Record module view
     * POST /user/module/recordView
     */
    recordView = async (req, res) => {
        try {
            const { courseId, moduleId, chapterId } = req.body;
            const userId = req.body.user_id; // From auth middleware

            // Validate user_id is set by middleware
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: "Authentication required"
                });
            }

            // Validate required fields
            if (!courseId || !moduleId || !chapterId) {
                return res.status(400).json({
                    success: false,
                    error: "courseId, moduleId, and chapterId are required"
                });
            }

            // Validate types
            if (isNaN(courseId) || isNaN(moduleId) || isNaN(chapterId)) {
                return res.status(400).json({
                    success: false,
                    error: "courseId, moduleId, and chapterId must be valid numbers"
                });
            }

            const result = await moduleViewsService.recordView(
                userId,
                courseId,
                moduleId,
                chapterId
            );

            if (!result.success) {
                // Check if it's an enrollment error
                const errorMessage = result.error?.message || result.error || 'Unknown error';
                if (typeof errorMessage === 'string' && errorMessage.includes("not enrolled")) {
                    return res.status(403).json({
                        success: false,
                        error: errorMessage
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: typeof errorMessage === 'string' ? errorMessage : 'An error occurred'
                });
            }

            return res.status(200).json({
                success: true,
                message: "Module view recorded successfully",
                data: result.data
            });
        } catch (error) {
            console.error('Error in recordView controller:', error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    };

    /**
     * Get recent viewed modules
     * GET /user/module/recentViews/:courseId
     */
    getRecentViews = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            const userId = req.body.user_id; // From auth middleware

            // Validate user_id is set by middleware
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: "Authentication required"
                });
            }

            if (!courseId || isNaN(courseId)) {
                return res.status(400).json({
                    success: false,
                    error: "Valid courseId is required"
                });
            }

            const result = await moduleViewsService.getRecentViews(userId, courseId);

            if (!result.success) {
                // Check if it's an enrollment error
                const errorMessage = result.error?.message || result.error || 'Unknown error';
                if (typeof errorMessage === 'string' && errorMessage.includes("not enrolled")) {
                    return res.status(403).json({
                        success: false,
                        error: errorMessage
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: typeof errorMessage === 'string' ? errorMessage : 'An error occurred'
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Error in getRecentViews controller:', error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    };

    /**
     * Get most recent module
     * GET /user/module/mostRecent/:courseId
     */
    getMostRecent = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            const userId = req.body.user_id; // From auth middleware

            // Validate user_id is set by middleware
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: "Authentication required"
                });
            }

            if (!courseId || isNaN(courseId)) {
                return res.status(400).json({
                    success: false,
                    error: "Valid courseId is required"
                });
            }

            const result = await moduleViewsService.getMostRecent(userId, courseId);

            if (!result.success) {
                // Check if it's an enrollment error
                const errorMessage = result.error?.message || result.error || 'Unknown error';
                if (typeof errorMessage === 'string' && errorMessage.includes("not enrolled")) {
                    return res.status(403).json({
                        success: false,
                        error: errorMessage
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: typeof errorMessage === 'string' ? errorMessage : 'An error occurred'
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Error in getMostRecent controller:', error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    };

    /**
     * Clear recent views
     * DELETE /user/module/recentViews/:courseId
     */
    clearRecentViews = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            const userId = req.body.user_id; // From auth middleware

            // Validate user_id is set by middleware
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: "Authentication required"
                });
            }

            if (!courseId || isNaN(courseId)) {
                return res.status(400).json({
                    success: false,
                    error: "Valid courseId is required"
                });
            }

            const result = await moduleViewsService.clearRecentViews(userId, courseId);

            if (!result.success) {
                // Check if it's an enrollment error
                const errorMessage = result.error?.message || result.error || 'Unknown error';
                if (typeof errorMessage === 'string' && errorMessage.includes("not enrolled")) {
                    return res.status(403).json({
                        success: false,
                        error: errorMessage
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: typeof errorMessage === 'string' ? errorMessage : 'An error occurred'
                });
            }

            return res.status(200).json({
                success: true,
                message: "Recent views cleared successfully",
                data: result.data
            });
        } catch (error) {
            console.error('Error in clearRecentViews controller:', error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    };
}

module.exports = { ModuleViewsController };

