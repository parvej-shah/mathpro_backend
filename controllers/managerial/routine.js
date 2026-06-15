const Controller = require("../base").Controller;
const RoutineService = require("../../service/managerial/routine.js").RoutineService;
const { checkCourseAccess, assertCourseAccess, getAccessibleCourseIds } = require("../../util/courseAccessHelpers");

const routineService = new RoutineService();

class RoutineController extends Controller {
    constructor() {
        super();
    }

    // List all routines (filtered by user permissions)
    list = async (req, res) => {
        const userId = req.user.id;
        const access = await getAccessibleCourseIds(userId, 'routine', 'manage');
        var result = await routineService.list(req, access);
        return res.status(result.success ? 200 : 400).json(result);
    };

    // List routines for a specific course
    listByCourse = async (req, res) => {
        const courseId = parseInt(req.params.courseId);
        const userId = req.user.id;

        const access = await checkCourseAccess(userId, 'routine', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }

        var result = await routineService.listByCourse(courseId);
        return res.status(result.success ? 200 : 400).json(result);
    };

    // Create a new routine
    create = async (req, res) => {
        const courseId = parseInt(req.params.courseId);
        const userId = req.user.id;
        
        const access = await checkCourseAccess(userId, 'routine', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }
        
        var result = await routineService.create(courseId, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    };

    // Update a routine
    update = async (req, res) => {
        const routineId = parseInt(req.params.id);
        const userId = req.user.id;
        
        const access = await assertCourseAccess(userId, 'routine', 'manage', 'routine', routineId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Routine not found' : 'No access to this course'
            });
        }
        
        var result = await routineService.update(routineId, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    };

    // Get single routine
    getEntry = async (req, res) => {
        const routineId = parseInt(req.params.id);
        const userId = req.user.id;

        const access = await assertCourseAccess(userId, 'routine', 'manage', 'routine', routineId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Routine not found' : 'No access to this course'
            });
        }

        var result = await routineService.get(routineId);
        return res.status(result.success ? 200 : 400).json(result);
    };

    // Delete a routine
    deleteEntry = async (req, res) => {
        const routineId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'routine', 'manage', 'routine', routineId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Routine not found' : 'No access to this course'
            });
        }
        
        var result = await routineService.deleteEntry(routineId);
        return res.status(result.success ? 200 : 400).json(result);
    };

    // Toggle active status
    toggleActive = async (req, res) => {
        const routineId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'routine', 'manage', 'routine', routineId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Routine not found' : 'No access to this course'
            });
        }
        
        var result = await routineService.toggleActive(
            routineId, 
            req.body.is_active
        );
        return res.status(result.success ? 200 : 400).json(result);
    };
}

module.exports = { RoutineController };
