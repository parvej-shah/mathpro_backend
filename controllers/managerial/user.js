const Controller = require('../base').Controller;
const { respond, catchAs } = require('../base');
const UserService = require('../../service/managerial/user').UserService;
const { managerialAccountTypes } = require('../../util/constants');

const userService = new UserService();

class UserController extends Controller {
    constructor() {
        super();
    }

    getAccessType = (req) => {
        return (req.query.type || req.body.type || 'course').toString().toLowerCase();
    }

    /**
     * LIST - Get all regular users with filtering and pagination
     * GET /admin/users?status=active&search=john&page=1&limit=20&sortBy=created_at&sortOrder=DESC
     */
    list = catchAs({ success: false, message: 'An error occurred while fetching users', error: 'SERVER_ERROR' }, async (req, res) => {
        const filters = {
            status: req.query.status,
            search: req.query.search,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo
        };

        const pagination = {
            page: req.query.page ? parseInt(req.query.page) : 1,
            limit: req.query.limit ? parseInt(req.query.limit) : 20,
            sortBy: req.query.sortBy || 'created_at',
            sortOrder: req.query.sortOrder || 'DESC'
        };

        const result = await userService.listUsers(filters, pagination);
        return respond(res, result);
    })

    /**
     * GET - Get single user by ID with details
     * GET /admin/users/:id
     */
    get = catchAs({ success: false, message: 'An error occurred while fetching user', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        const result = await userService.getUserDetails(id);
        return res.status(result.success ? 200 : 404).json(result);
    })

    /**
     * GET - Get single user's full history
     * GET /admin/users/:id/history
     */
    getHistory = catchAs({ success: false, message: 'An error occurred while fetching user history', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        const result = await userService.getUserHistory(id);
        return res.status(result.success ? 200 : 404).json(result);
    })

    /**
     * CREATE - Create new regular user
     * POST /admin/users
     * Body: { name, email, phone?, profile? }
     */
    create = catchAs({ success: false, message: 'An error occurred while creating user', error: 'SERVER_ERROR' }, async (req, res) => {
        const { name, email, phone, profile } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Name is required',
                error: 'MISSING_NAME'
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required',
                error: 'MISSING_EMAIL'
            });
        }

        const result = await userService.createUser({ name, email, phone, profile });
        return res.status(result.success ? 201 : 400).json(result);
    })

    /**
     * UPDATE - Update user information
     * PUT /admin/users/:id
     * Body: { name?, email?, phone?, profile? }
     */
    update = catchAs({ success: false, message: 'An error occurred while updating user', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        // Prevent changing user type to anything other than regular user (3)
        if (req.body.type !== undefined && parseInt(req.body.type) !== managerialAccountTypes.regular) {
            return res.status(403).json({
                success: false,
                message: 'Changing user type is not allowed',
                error: 'FORBIDDEN'
            });
        }

        const { name, email, phone, profile } = req.body;
        const adminId = req.body.user_id;

        const result = await userService.updateUser(id, { name, email, phone, profile }, adminId);
        return respond(res, result);
    })

    /**
     * DELETE - Delete or deactivate user
     * DELETE /admin/users/:id?permanent=true
     */
    delete = catchAs({ success: false, message: 'An error occurred while deleting user', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        // Prevent admin from deleting themselves
        if (id === req.body.user_id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account',
                error: 'SELF_DELETE_FORBIDDEN'
            });
        }

        const permanent = req.query.permanent === 'true';
        const adminId = req.body.user_id;

        const result = await userService.deleteUser(id, adminId, permanent);
        return respond(res, result);
    })

    /**
     * RESET PASSWORD - Reset user password
     * POST /admin/users/:id/reset-password
     */
    resetPassword = catchAs({ success: false, message: 'An error occurred while resetting password', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        const adminId = req.body.user_id;
        const result = await userService.resetUserPassword(id, adminId);
        return respond(res, result);
    })

    /**
     * GET - List all access entries for a user
     * GET /admin/users/:id/access
     */
    getUserCourseAccess = catchAs({ success: false, message: 'An error occurred while fetching course access', error: 'SERVER_ERROR' }, async (req, res) => {
        const userId = parseInt(req.params.id);
        const accessType = this.getAccessType(req);
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        let result;
        if (accessType === 'bundle') {
            result = await userService.getStudentBundleAccess(userId);
        } else if (accessType === 'course') {
            result = await userService.getStudentCourseAccess(userId);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Use type=course or type=bundle',
                error: 'INVALID_TYPE'
            });
        }
        return respond(res, result);
    })

    /**
     * POST - Grant access to a user
     * POST /admin/users/:id/access
     * Body: { courseId }
     */
    grantUserCourseAccess = catchAs({ success: false, message: 'An error occurred while granting course access', error: 'SERVER_ERROR' }, async (req, res) => {
        const userId = parseInt(req.params.id);
        const accessType = this.getAccessType(req);
        const courseId = parseInt(req.body.courseId || req.query.courseId);
        const bundleId = parseInt(req.body.bundleId || req.query.bundleId);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        let result;
        if (accessType === 'bundle') {
            if (isNaN(bundleId)) {
                return res.status(400).json({
                    success: false,
                    message: 'bundleId is required for type=bundle',
                    error: 'MISSING_BUNDLE_ID'
                });
            }
            result = await userService.grantStudentBundleAccess(userId, bundleId);
        } else if (accessType === 'course') {
            if (isNaN(courseId)) {
                return res.status(400).json({
                    success: false,
                    message: 'courseId is required for type=course',
                    error: 'MISSING_COURSE_ID'
                });
            }
            result = await userService.grantStudentCourseAccess(userId, courseId);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Use type=course or type=bundle',
                error: 'INVALID_TYPE'
            });
        }

        if (!result.success && result.error === 'Student already has access to this course') {
            return res.status(409).json({
                success: false,
                message: result.error,
                error: 'DUPLICATE_ACCESS'
            });
        }
        if (!result.success && result.error === 'Student already has access to this bundle') {
            return res.status(409).json({
                success: false,
                message: result.error,
                error: 'DUPLICATE_ACCESS'
            });
        }
        if (!result.success && (result.error === 'User not found' || result.error === 'Course not found')) {
            return res.status(404).json({
                success: false,
                message: result.error,
                error: 'NOT_FOUND'
            });
        }
        if (!result.success && result.error === 'Bundle not found') {
            return res.status(404).json({
                success: false,
                message: result.error,
                error: 'NOT_FOUND'
            });
        }
        if (!result.success && result.error === 'Target user is not a student (type 3)') {
            return res.status(400).json({
                success: false,
                message: result.error,
                error: 'INVALID_TARGET_USER'
            });
        }

        return res.status(result.success ? 201 : 400).json(result);
    })

    /**
     * DELETE - Revoke access from a user
     * DELETE /admin/users/:id/access
     */
    revokeUserCourseAccess = catchAs({ success: false, message: 'An error occurred while revoking course access', error: 'SERVER_ERROR' }, async (req, res) => {
        const userId = parseInt(req.params.id);
        const accessType = this.getAccessType(req);
        const courseId = parseInt(req.params.courseId || req.query.courseId);
        const bundleId = parseInt(req.params.bundleId || req.query.bundleId);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        let result;
        if (accessType === 'bundle') {
            if (isNaN(bundleId)) {
                return res.status(400).json({
                    success: false,
                    message: 'bundleId is required for type=bundle',
                    error: 'MISSING_BUNDLE_ID'
                });
            }
            result = await userService.revokeStudentBundleAccess(userId, bundleId);
        } else if (accessType === 'course') {
            if (isNaN(courseId)) {
                return res.status(400).json({
                    success: false,
                    message: 'courseId is required for type=course',
                    error: 'MISSING_COURSE_ID'
                });
            }
            result = await userService.revokeStudentCourseAccess(userId, courseId);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Use type=course or type=bundle',
                error: 'INVALID_TYPE'
            });
        }

        if (!result.success && result.error === 'Student course access not found') {
            return res.status(404).json({
                success: false,
                message: result.error,
                error: 'NOT_FOUND'
            });
        }
        if (!result.success && result.error === 'Student bundle access not found') {
            return res.status(404).json({
                success: false,
                message: result.error,
                error: 'NOT_FOUND'
            });
        }

        return respond(res, result);
    })

}

module.exports = { UserController };
