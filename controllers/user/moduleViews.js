const Controller = require("../base").Controller;
const { catchAs } = require("../base");
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
    recordView = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
    });

    /**
     * Get most recent module
     * GET /user/module/mostRecent/:courseId
     */
    getMostRecent = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
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
    });

}

module.exports = { ModuleViewsController };

