/**
 * User Instructor Controller
 * Public endpoints for instructor information
 */

const Controller = require("../base").Controller;
const TeacherServiceV2 = require("../../service/managerial/teacherV2").TeacherServiceV2;

const teacherServiceV2 = new TeacherServiceV2();

class InstructorController extends Controller {
    constructor() {
        super();
    }

    /**
     * GET /user/instructor/list
     * Get all instructors for public display (courses page)
     * No authentication required
     */
    list = async (req, res) => {
        try {
            const result = await teacherServiceV2.getPublicInstructors();

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error || "Failed to retrieve instructors",
                    data: null
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data || []
            });
        } catch (error) {
            console.error("Error in instructor list:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error",
                data: null
            });
        }
    };
}

module.exports = { InstructorController };

