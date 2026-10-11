const Controller = require('../base').Controller;
const { respond, catchAs, handle } = require('../base');
const AdminService = require('../../service/managerial/admin').AdminService;

const adminService = new AdminService();

class AdminController extends Controller {
    constructor() {
        super();
    }

    /**
     * LIST - Get all admins
     * GET /admin/admins
     */
    list = catchAs({ success: false, message: 'An error occurred while fetching admins', error: 'SERVER_ERROR' }, handle(() => adminService.list()))

    /**
     * GET - Get single admin by ID
     * GET /admin/admins/:id
     */
    get = catchAs({ success: false, message: 'An error occurred while fetching admin', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid admin ID',
                error: 'INVALID_ID'
            });
        }

        const result = await adminService.get(id);
        return res.status(result.success ? 200 : 404).json(result);
    })

    /**
     * CREATE - Create new admin
     * POST /admin/admins
     */
    create = catchAs({ success: false, message: 'An error occurred while creating admin', error: 'SERVER_ERROR' }, async (req, res) => {
        const result = await adminService.create(req.body);
        return res.status(result.success ? 201 : 400).json(result);
    })

    /**
     * UPDATE - Update admin
     * PUT /admin/admins/:id
     */
    update = catchAs({ success: false, message: 'An error occurred while updating admin', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid admin ID',
                error: 'INVALID_ID'
            });
        }

        const updaterId = req.body.user_id;
        const result = await adminService.update(id, req.body, updaterId);
        return respond(res, result);
    })

    /**
     * SET PASSWORD - Set/reset admin password
     * POST /admin/admins/:id/set-password
     */
    setPassword = catchAs({ success: false, message: 'An error occurred while setting password', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid admin ID',
                error: 'INVALID_ID'
            });
        }

        const { currentPassword } = req.body;
        if (!currentPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password is required',
                error: 'MISSING_PASSWORD'
            });
        }

        const updaterId = req.body.user_id;
        const result = await adminService.setPassword(id, updaterId, currentPassword);
        return respond(res, result);
    })

    /**
     * PROMOTE - Promote existing user to admin/moderator
     * POST /admin/admins/:id/promote
     */
    promote = catchAs({ success: false, message: 'An error occurred while promoting user', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                error: 'INVALID_ID'
            });
        }

        const { type } = req.body;
        if (!type) {
            return res.status(400).json({
                success: false,
                message: 'Type is required',
                error: 'MISSING_TYPE'
            });
        }

        const result = await adminService.promote(id, type);
        return respond(res, result);
    })

    /**
     * SEARCH USERS - Search regular users for promotion
     * GET /admin/admins/search-users?q=...
     */
    searchUsers = catchAs({ success: false, message: 'An error occurred while searching users', error: 'SERVER_ERROR' }, async (req, res) => {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query (q) is required',
                error: 'MISSING_QUERY'
            });
        }

        const result = await adminService.searchUsers(query);
        return respond(res, result);
    })

    /**
     * DELETE - Delete admin
     * DELETE /admin/admins/:id
     */
    delete = catchAs({ success: false, message: 'An error occurred while deleting admin', error: 'SERVER_ERROR' }, async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid admin ID',
                error: 'INVALID_ID'
            });
        }

        const result = await adminService.delete(id);
        return respond(res, result);
    })
}

module.exports = { AdminController };

