const { Controller } = require('../base');
const { RoleService } = require('../../service/managerial/roleService');
const { PERMISSIONS, getAssignablePermissions, getAssignablePermissionsByResource } = require('../../util/permissions');

const roleService = new RoleService();

/**
 * RoleController - Admin API for Role Management
 * 
 * Endpoints:
 * - GET    /api/managerial/roles              - List all roles
 * - GET    /api/managerial/roles/:id          - Get single role
 * - POST   /api/managerial/roles              - Create new role
 * - PUT    /api/managerial/roles/:id          - Update role
 * - DELETE /api/managerial/roles/:id          - Delete role
 * - GET    /api/managerial/users/:userId/roles - Get user's roles
 * - POST   /api/managerial/users/:userId/roles - Assign role to user
 * - DELETE /api/managerial/users/:userId/roles/:roleId - Remove role from user
 * 
 * All endpoints require admin authentication with role.manage.all permission
 */
class RoleController extends Controller {
    constructor() {
        super();
    }

    /**
     * GET ALL VALID PERMISSIONS (for role create/edit UI)
     * GET /admin/roles/permissions
     * Returns only assignable permissions (.manage.all) that are actually used by API routes.
     */
    getPermissionsList = async (req, res) => {
        try {
            const assignablePermissions = getAssignablePermissions();
            const byResource = getAssignablePermissionsByResource();

            return res.status(200).json({
                success: true,
                data: {
                    all: assignablePermissions,
                    by_resource: byResource      // Grouped by resource
                },
                count: assignablePermissions.length
            });
        } catch (error) {
            console.error('Error in getPermissionsList controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while fetching permissions list',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * LIST ALL ROLES
     * GET /api/managerial/roles
     * Returns all roles in the system
     */
    listRoles = async (req, res) => {
        try {
            const result = await roleService.getAllRoles();

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to fetch roles',
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data,
                count: result.data.length
            });
        } catch (error) {
            console.error('Error in listRoles controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while fetching roles',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * GET SINGLE ROLE
     * GET /api/managerial/roles/:id
     * Returns a single role by ID
     */
    getRole = async (req, res) => {
        try {
            const roleId = parseInt(req.params.id);

            if (!roleId || isNaN(roleId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID',
                    error: 'INVALID_ID'
                });
            }

            const result = await roleService.getRoleById(roleId);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.error || 'Role not found',
                    error: 'NOT_FOUND'
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Error in getRole controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while fetching role',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * CREATE NEW ROLE
     * POST /api/managerial/roles
     * Body: { name, display_name, description, permissions[] }
     */
    createRole = async (req, res) => {
        try {
            const { name, display_name, description, permissions } = req.body;

            // Validate required fields
            if (!name || !display_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Name and display name are required',
                    error: 'MISSING_FIELDS'
                });
            }

            // Validate permissions array
            if (permissions && !Array.isArray(permissions)) {
                return res.status(400).json({
                    success: false,
                    message: 'Permissions must be an array',
                    error: 'INVALID_PERMISSIONS'
                });
            }

            const roleData = {
                name: name.toLowerCase().trim(),
                display_name: display_name.trim(),
                description: description?.trim() || null,
                permissions: permissions || []
            };

            const result = await roleService.createRole(roleData);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to create role',
                    error: 'CREATE_FAILED'
                });
            }

            return res.status(201).json({
                success: true,
                message: 'Role created successfully',
                data: result.data
            });
        } catch (error) {
            console.error('Error in createRole controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while creating role',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * UPDATE ROLE
     * PUT /api/managerial/roles/:id
     * Body: { display_name?, description?, permissions[]? }
     */
    updateRole = async (req, res) => {
        try {
            const roleId = parseInt(req.params.id);

            if (!roleId || isNaN(roleId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID',
                    error: 'INVALID_ID'
                });
            }

            const { name, display_name, description, permissions } = req.body;

            // Validate at least one field is provided
            if (!name && !display_name && !description && !permissions) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one field must be provided for update',
                    error: 'NO_UPDATE_FIELDS'
                });
            }

            // Validate permissions array if provided
            if (permissions && !Array.isArray(permissions)) {
                return res.status(400).json({
                    success: false,
                    message: 'Permissions must be an array',
                    error: 'INVALID_PERMISSIONS'
                });
            }

            const updateData = {};
            if (name !== undefined) updateData.name = name.toLowerCase().trim();
            if (display_name !== undefined) updateData.display_name = display_name.trim();
            if (description !== undefined) updateData.description = description?.trim() || null;
            if (permissions !== undefined) updateData.permissions = permissions;

            const result = await roleService.updateRole(roleId, updateData);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to update role',
                    error: 'UPDATE_FAILED'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Role updated successfully',
                data: result.data
            });
        } catch (error) {
            console.error('Error in updateRole controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while updating role',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * DELETE ROLE
     * DELETE /api/managerial/roles/:id
     * Deletes a role (with safety checks)
     */
    deleteRole = async (req, res) => {
        try {
            const roleId = parseInt(req.params.id);

            if (!roleId || isNaN(roleId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID',
                    error: 'INVALID_ID'
                });
            }

            const result = await roleService.deleteRole(roleId);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to delete role',
                    error: 'DELETE_FAILED'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Role deleted successfully'
            });
        } catch (error) {
            console.error('Error in deleteRole controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while deleting role',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * GET USER'S ROLES
     * GET /api/managerial/users/:userId/roles
     * Returns all roles assigned to a user
     */
    getUserRoles = async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);

            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user ID',
                    error: 'INVALID_USER_ID'
                });
            }

            const result = await roleService.getUserRoles(userId);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to fetch user roles',
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data,
                count: result.data.length
            });
        } catch (error) {
            console.error('Error in getUserRoles controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while fetching user roles',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * GET USER'S PERMISSIONS
     * GET /api/managerial/users/:userId/permissions
     * Returns aggregated permissions for a user
     */
    getUserPermissions = async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);

            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user ID',
                    error: 'INVALID_USER_ID'
                });
            }

            const result = await roleService.getUserPermissions(userId);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to fetch user permissions',
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data,
                count: result.data.length
            });
        } catch (error) {
            console.error('Error in getUserPermissions controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while fetching user permissions',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * ASSIGN ROLE TO USER
     * POST /api/managerial/users/:userId/roles
     * Body: { role_id }
     */
    assignRole = async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const roleId = parseInt(req.body.role_id);
            const adminId = req.body.user_id; // From auth middleware

            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user ID',
                    error: 'INVALID_USER_ID'
                });
            }

            if (!roleId || isNaN(roleId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID',
                    error: 'INVALID_ROLE_ID'
                });
            }

            const result = await roleService.assignRole(userId, roleId, adminId);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to assign role',
                    error: 'ASSIGN_FAILED'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Role assigned successfully',
                data: result.data
            });
        } catch (error) {
            console.error('Error in assignRole controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while assigning role',
                error: 'SERVER_ERROR'
            });
        }
    };

    /**
     * REMOVE ROLE FROM USER
     * DELETE /api/managerial/users/:userId/roles/:roleId
     */
    removeRole = async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const roleId = parseInt(req.params.roleId);
            const adminId = req.body.user_id; // From auth middleware

            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user ID',
                    error: 'INVALID_USER_ID'
                });
            }

            if (!roleId || isNaN(roleId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID',
                    error: 'INVALID_ROLE_ID'
                });
            }

            const result = await roleService.removeRole(userId, roleId, adminId);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to remove role',
                    error: 'REMOVE_FAILED'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Role removed successfully',
                data: result.data
            });
        } catch (error) {
            console.error('Error in removeRole controller:', error);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while removing role',
                error: 'SERVER_ERROR'
            });
        }
    };
}

module.exports = { RoleController };

