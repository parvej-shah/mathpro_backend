const Controller = require('../base').Controller;
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
    list = async (req, res) => {
        try {
            const result = await adminService.list();
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in admin list controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while fetching admins',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * GET - Get single admin by ID
     * GET /admin/admins/:id
     */
    get = async (req, res) => {
        try {
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
        } catch (error) {
            console.error('Error in admin get controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while fetching admin',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * CREATE - Create new admin
     * POST /admin/admins
     */
    create = async (req, res) => {
        try {
            const result = await adminService.create(req.body);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Error in admin create controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while creating admin',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * UPDATE - Update admin
     * PUT /admin/admins/:id
     */
    update = async (req, res) => {
        try {
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
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in admin update controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while updating admin',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * SET PASSWORD - Set/reset admin password
     * POST /admin/admins/:id/set-password
     */
    setPassword = async (req, res) => {
        try {
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
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in admin setPassword controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while setting password',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * PROMOTE - Promote existing user to admin/moderator
     * POST /admin/admins/:id/promote
     */
    promote = async (req, res) => {
        try {
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
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in admin promote controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while promoting user',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * SEARCH USERS - Search regular users for promotion
     * GET /admin/admins/search-users?q=...
     */
    searchUsers = async (req, res) => {
        try {
            const query = req.query.q;
            if (!query) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query (q) is required',
                    error: 'MISSING_QUERY'
                });
            }

            const result = await adminService.searchUsers(query);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in searchUsers controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while searching users',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * DELETE - Delete admin
     * DELETE /admin/admins/:id
     */
    delete = async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid admin ID',
                    error: 'INVALID_ID'
                });
            }

            const result = await adminService.delete(id);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in admin delete controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while deleting admin',
                error: 'SERVER_ERROR'
            });
        }
    }
}

module.exports = { AdminController };

