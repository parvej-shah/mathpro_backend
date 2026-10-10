const Controller = require("../base").Controller;
const { respond } = require('../base');
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
        return respond(res, result);
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
        return respond(res, result);
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
        return respond(res, result);
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
        return respond(res, result);
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
        return respond(res, result);
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
        return respond(res, result);
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
        return respond(res, result);
    };
}

module.exports = { RoutineController };
