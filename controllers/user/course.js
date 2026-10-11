const Controller = require("../base").Controller;
const { respond, handle } = require('../base');
const { parseLimitOffset } = require('../../util/pagination');
const CourseService = require("../../service/managerial/course.js").CourseService
const FeaturedItemService = require("../../service/managerial/featuredItem").FeaturedItemService
const RoutineService = require("../../service/managerial/routine.js").RoutineService

const courseService = new CourseService()
const featuredItemService = new FeaturedItemService()
const routineService = new RoutineService()

class CourseController extends Controller {
    constructor() {
        super();
    }
    list = handle((req) => courseService.listForUser(req));
    featured = handle(() => featuredItemService.listPublic());
    // Public course directory grouped by category (FT-style homepage layout).
    directory = handle((req) => courseService.directoryForUser(req));

    enrollFree = handle((req) => courseService.enrollFree(req.body.user_id, parseInt(req.params.id)))
    getFull = handle((req) => courseService.getFullUser(req.body, req.params.id))

    getFullBySlug = handle((req) => courseService.getFullUserBySlug(req.body, req.params.slug))

    getRanking = async (req, res) => {
        const { limit, offset } = parseLimitOffset(req.query, { defaultLimit: 10 });
        var result = await courseService.getRanking(req.body, parseInt(req.params.id), offset, limit)
        return respond(res, result)
    }

    prebook = async (req, res) => {
        // Validate required fields
        const { email, name, phone } = req.body;
        const missingFields = [];

        if (!email || email.trim() === '') missingFields.push('email');
        if (!name || name.trim() === '') missingFields.push('name');
        if (!phone || phone.trim() === '') missingFields.push('phone');

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}. Name, email, and phone are required for prebooking.`
            });
        }

        var result = await courseService.prebook(req.params.id, req.body)
        return respond(res, result)
    }

    applyCoupon = handle((req) => courseService.applyCoupon(req.body.user_id, req.params.course_id, req.body.coupon))

    getAnalytics = handle(() => courseService.getAnalytics())

    // Dashboard listing: enrolled courses + purchased bundles with thumbnails/slug/progress.
    getMyDashboard = handle((req) => courseService.getMyDashboard(req.body.user_id))

    getEnrolledCoursesByUserId = handle((req) => courseService.getEnrolledCoursesByUserId(req.body.user_id))

    // Get current week's routine for a course
    getRoutine = handle((req) => routineService.getCurrentRoutine(parseInt(req.params.courseId)))

    // Get lightweight dashboard data for a course
    getDashboard = handle((req) => courseService.getDashboard(req.body, req.params.id))
}

module.exports = { CourseController }
