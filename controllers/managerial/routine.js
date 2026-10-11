const Controller = require("../base").Controller;
const { respond } = require('../base');
const RoutineService = require("../../service/managerial/routine.js").RoutineService;
const { getAccessibleCourseIds } = require("../../util/courseAccessHelpers");
const { denyCourseAccess, denyResourceAccess } = require('../shared/courseAccess');

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

        if (await denyCourseAccess(res, userId, 'routine', courseId)) return;

        var result = await routineService.listByCourse(courseId);
        return respond(res, result);
    };

    // Create a new routine
    create = async (req, res) => {
        const courseId = parseInt(req.params.courseId);
        const userId = req.user.id;
        
        if (await denyCourseAccess(res, userId, 'routine', courseId)) return;
        
        var result = await routineService.create(courseId, req.body);
        return respond(res, result);
    };

    // Update a routine
    update = async (req, res) => {
        const routineId = parseInt(req.params.id);
        const userId = req.user.id;
        
        if (await denyResourceAccess(res, userId, 'routine', routineId, 'Routine not found')) return;
        
        var result = await routineService.update(routineId, req.body);
        return respond(res, result);
    };

    // Get single routine
    getEntry = async (req, res) => {
        const routineId = parseInt(req.params.id);
        const userId = req.user.id;

        if (await denyResourceAccess(res, userId, 'routine', routineId, 'Routine not found')) return;

        var result = await routineService.get(routineId);
        return respond(res, result);
    };

    // Delete a routine
    deleteEntry = async (req, res) => {
        const routineId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'routine', routineId, 'Routine not found')) return;
        
        var result = await routineService.deleteEntry(routineId);
        return respond(res, result);
    };

    // Toggle active status
    toggleActive = async (req, res) => {
        const routineId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'routine', routineId, 'Routine not found')) return;
        
        var result = await routineService.toggleActive(
            routineId, 
            req.body.is_active
        );
        return respond(res, result);
    };
}

module.exports = { RoutineController };
