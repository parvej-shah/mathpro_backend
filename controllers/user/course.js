const Controller = require("../base").Controller;
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
    list = async (req, res) => {
        var result = await courseService.listForUser(req);
        return res.status(result.success ? 200 : 400).json(result);
    };
    featured = async (req, res) => {
        var result = await featuredItemService.listPublic();
        return res.status(result.success ? 200 : 400).json(result);
    };
    // Public course directory grouped by category (FT-style homepage layout).
    directory = async (req, res) => {
        var result = await courseService.directoryForUser(req);
        return res.status(result.success ? 200 : 400).json(result);
    };
    takes = async (req, res) => {
        var result = await courseService.takes(req.body.user_id, req.params.id)
        return res.status(result.success ? 200 : 400).json(result)
    }
    getFull = async (req, res) => {
        var result = await courseService.getFullUser(req.body, req.params.id)
        return res.status(result.success ? 200 : 400).json(result)
    }

    getFullBySlug = async (req, res) => {
        var result = await courseService.getFullUserBySlug(req.body, req.params.slug)
        return res.status(result.success ? 200 : 400).json(result)
    }

    getScore = async (req, res) => {
        var result = await courseService.getScore(req.body, parseInt(req.params.id))
        return res.status(result.success ? 200 : 400).json(result)
    }

    getRanking = async (req, res) => {
        var result = await courseService.getRanking(req.body, parseInt(req.params.id), parseInt(req.query.offset), parseInt(req.query.limit))
        return res.status(result.success ? 200 : 400).json(result)
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
        return res.status(result.success ? 200 : 400).json(result)
    }

    prebookBundle = async (req, res) => {
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

        var result = await courseService.prebookBundle(req.params.id, req.body)
        return res.status(result.success ? 200 : 400).json(result)
    }

    getWishList = async (req, res) => {
        var result = await courseService.getWishList(req.body.user_id)
        return res.status(result.success ? 200 : 400).json(result)
    }

    applyCoupon = async (req, res) => {
        var result = await courseService.applyCoupon(req.body.user_id, req.params.course_id, req.body.coupon)
        return res.status(result.success ? 200 : 400).json(result)
    }

    getAnalytics = async (req, res) => {
        var result = await courseService.getAnalytics()
        return res.status(result.success ? 200 : 400).json(result)
    }

    getMyCoursesPage = async (req, res) => {
        var result = await courseService.getMyCoursesPage(req.body.user_id)
        return res.status(result.success ? 200 : 400).json(result)
    }

    // Dashboard listing: enrolled courses + purchased bundles with thumbnails/slug/progress.
    getMyDashboard = async (req, res) => {
        var result = await courseService.getMyDashboard(req.body.user_id)
        return res.status(result.success ? 200 : 400).json(result)
    }

    getMyCourses = async (req, res) => {
        var result = await courseService.getMyCourses(req.body.user_id)
        return res.status(result.success ? 200 : 400).json(result)
    }

    getEnrolledCoursesByUserId = async (req, res) => {
        var result = await courseService.getEnrolledCoursesByUserId(req.body.user_id)
        return res.status(result.success ? 200 : 400).json(result)
    }

    // Get current week's routine for a course
    getRoutine = async (req, res) => {
        var result = await routineService.getCurrentRoutine(parseInt(req.params.courseId))
        return res.status(result.success ? 200 : 400).json(result)
    }

    // Get lightweight dashboard data for a course
    getDashboard = async (req, res) => {
        var result = await courseService.getDashboard(req.body, req.params.id)
        return res.status(result.success ? 200 : 400).json(result)
    }
}

module.exports = { CourseController }
