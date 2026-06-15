const { Service } = require('../base');
const { PERMISSIONS, isValidPermission, validatePermissions, getAssignablePermissions } = require('../../util/permissions');
const { SUPER_ADMIN_ROLE_NAME } = require('../../util/constants');

/**
 * RoleService - RBAC Role and Permission Management
 * 
 * This service handles all role and permission operations including:
 * - Fetching user roles and permissions
 * - Permission checking (single, any, all)
 * - Scope-based access control
 * - Role assignment and removal
 * - Role CRUD operations
 * 
 * @extends Service
 */
class RoleService extends Service {
    constructor() {
        super();
    }

    // ========================================
    // CORE PERMISSION RETRIEVAL METHODS
    // ========================================

    /**
     * Get all roles assigned to a user
     * @param {number} userId - User ID
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    getUserRoles = async (userId) => {
        try {
            if (!userId) {
                return {
                    success: false,
                    error: 'User ID is required'
                };
            }

            const query = `
                SELECT 
                    r.id,
                    r.name,
                    r.display_name,
                    r.description,
                    r.permissions,
                    ur.created_at as assigned_at,
                    ur.updated_by
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1
                ORDER BY r.id
            `;

            const result = await this.query(query, [userId]);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to fetch user roles'
                };
            }

            return {
                success: true,
                data: result.data
            };
        } catch (error) {
            console.error('Error in getUserRoles:', error);
            return {
                success: false,
                error: 'Failed to fetch user roles'
            };
        }
    };

    /**
     * Get aggregated permissions for a user from all assigned roles
     * Uses the database function get_user_permissions for efficiency
     * @param {number} userId - User ID
     * @returns {Promise<{success: boolean, data?: string[], error?: string}>}
     */
    getUserPermissions = async (userId) => {
        try {
            if (!userId) {
                return {
                    success: false,
                    error: 'User ID is required'
                };
            }

            // Use the database helper function for efficient aggregation
            const query = `SELECT get_user_permissions($1) as permissions`;
            const result = await this.query(query, [userId]);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to fetch user permissions'
                };
            }

            // Extract permissions array from JSONB result
            const permissions = result.data[0]?.permissions || [];

            return {
                success: true,
                data: permissions
            };
        } catch (error) {
            console.error('Error in getUserPermissions:', error);
            return {
                success: false,
                error: 'Failed to fetch user permissions'
            };
        }
    };

    // ========================================
    // PERMISSION CHECKING METHODS
    // ========================================

    /**
     * Check if user has a specific permission
     * @param {number} userId - User ID
     * @param {string} permission - Permission string (e.g., 'user.read.all')
     * @returns {Promise<{success: boolean, hasPermission?: boolean, error?: string}>}
     */
    hasPermission = async (userId, permission) => {
        try {
            if (!userId || !permission) {
                return {
                    success: false,
                    error: 'User ID and permission are required'
                };
            }

            // Validate permission format
            if (!isValidPermission(permission)) {
                return {
                    success: false,
                    error: `Invalid permission: ${permission}`
                };
            }

            const permissionsResult = await this.getUserPermissions(userId);

            if (!permissionsResult.success) {
                return permissionsResult;
            }

            const hasPermission = permissionsResult.data.includes(permission);

            return {
                success: true,
                hasPermission
            };
        } catch (error) {
            console.error('Error in hasPermission:', error);
            return {
                success: false,
                error: 'Failed to check permission'
            };
        }
    };

    /**
     * Check if user has ANY of the specified permissions
     * @param {number} userId - User ID
     * @param {string[]} permissions - Array of permission strings
     * @returns {Promise<{success: boolean, hasPermission?: boolean, matchedPermission?: string, error?: string}>}
     */
    hasAnyPermission = async (userId, permissions) => {
        try {
            if (!userId || !permissions || !Array.isArray(permissions)) {
                return {
                    success: false,
                    error: 'User ID and permissions array are required'
                };
            }

            if (permissions.length === 0) {
                return {
                    success: true,
                    hasPermission: false
                };
            }

            // Validate all permissions
            const validation = validatePermissions(permissions);
            if (!validation.valid) {
                return {
                    success: false,
                    error: `Invalid permissions: ${validation.invalid.join(', ')}`
                };
            }

            const permissionsResult = await this.getUserPermissions(userId);

            if (!permissionsResult.success) {
                return permissionsResult;
            }

            const userPermissions = permissionsResult.data;
            const matchedPermission = permissions.find(p => userPermissions.includes(p));

            return {
                success: true,
                hasPermission: !!matchedPermission,
                matchedPermission: matchedPermission || null
            };
        } catch (error) {
            console.error('Error in hasAnyPermission:', error);
            return {
                success: false,
                error: 'Failed to check permissions'
            };
        }
    };

    /**
     * Check if user has ALL of the specified permissions
     * @param {number} userId - User ID
     * @param {string[]} permissions - Array of permission strings
     * @returns {Promise<{success: boolean, hasPermission?: boolean, missingPermissions?: string[], error?: string}>}
     */
    hasAllPermissions = async (userId, permissions) => {
        try {
            if (!userId || !permissions || !Array.isArray(permissions)) {
                return {
                    success: false,
                    error: 'User ID and permissions array are required'
                };
            }

            if (permissions.length === 0) {
                return {
                    success: true,
                    hasPermission: true,
                    missingPermissions: []
                };
            }

            // Validate all permissions
            const validation = validatePermissions(permissions);
            if (!validation.valid) {
                return {
                    success: false,
                    error: `Invalid permissions: ${validation.invalid.join(', ')}`
                };
            }

            const permissionsResult = await this.getUserPermissions(userId);

            if (!permissionsResult.success) {
                return permissionsResult;
            }

            const userPermissions = permissionsResult.data;
            const missingPermissions = permissions.filter(p => !userPermissions.includes(p));

            return {
                success: true,
                hasPermission: missingPermissions.length === 0,
                missingPermissions
            };
        } catch (error) {
            console.error('Error in hasAllPermissions:', error);
            return {
                success: false,
                error: 'Failed to check permissions'
            };
        }
    };

    // ========================================
    // SCOPE-BASED ACCESS CONTROL
    // ========================================

    /**
     * Check if user has access to a resource.
     * Requires resource.action.all permission.
     *
     * @param {number} userId - User ID
     * @param {string} resource - Resource name (e.g., 'course', 'revenue')
     * @param {string} action - Action name (e.g., 'manage', 'update')
     * @returns {Promise<{success: boolean, hasAccess?: boolean, reason?: string, error?: string}>}
     */
    hasScopeAccess = async (userId, resource, action) => {
        try {
            if (!userId || !resource || !action) {
                return {
                    success: false,
                    error: 'User ID, resource, and action are required'
                };
            }

            const permissionsResult = await this.getUserPermissions(userId);

            if (!permissionsResult.success) {
                return permissionsResult;
            }

            const userPermissions = permissionsResult.data;
            const globalPermission = `${resource}.${action}.all`;

            if (userPermissions.includes(globalPermission)) {
                return {
                    success: true,
                    hasAccess: true,
                    reason: `User has global permission: ${globalPermission}`
                };
            }

            return {
                success: true,
                hasAccess: false,
                reason: `User does not have ${globalPermission}`
            };
        } catch (error) {
            console.error('Error in hasScopeAccess:', error);
            return {
                success: false,
                error: 'Failed to check scope access'
            };
        }
    };

    // ========================================
    // ROLE ASSIGNMENT METHODS
    // ========================================

    /**
     * Get role id by role name
     * @param {string} name - Role name (e.g. 'teacher', 'admin')
     * @returns {Promise<{success: boolean, data?: number, error?: string}>} data is role id or null if not found
     */
    getRoleIdByName = async (name) => {
        try {
            if (!name) {
                return { success: true, data: null };
            }
            const result = await this.query(
                'SELECT id FROM roles WHERE name = $1',
                [name]
            );
            if (!result.success || !result.data || result.data.length === 0) {
                return { success: true, data: null };
            }
            return {
                success: true,
                data: result.data[0].id
            };
        } catch (error) {
            console.error('Error in getRoleIdByName:', error);
            return {
                success: false,
                error: 'Failed to fetch role by name'
            };
        }
    };

    /**
     * Assign a role to a user
     * @param {number} userId - User ID
     * @param {number} roleId - Role ID
     * @param {number} updatedBy - ID of user performing the assignment
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    assignRole = async (userId, roleId, updatedBy) => {
        try {
            if (!userId || !roleId) {
                return {
                    success: false,
                    error: 'User ID and Role ID are required'
                };
            }

            // Check if role exists
            const roleCheck = await this.query(
                'SELECT id, name, display_name FROM roles WHERE id = $1',
                [roleId]
            );

            if (!roleCheck.success || roleCheck.data.length === 0) {
                return {
                    success: false,
                    error: 'Role not found'
                };
            }

            // Check if user already has this role
            const existingCheck = await this.query(
                'SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2',
                [userId, roleId]
            );

            if (existingCheck.success && existingCheck.data.length > 0) {
                return {
                    success: false,
                    error: 'User already has this role'
                };
            }

            // Assign the role
            const insertQuery = `
                INSERT INTO user_roles (user_id, role_id, updated_by)
                VALUES ($1, $2, $3)
                RETURNING id, user_id, role_id, created_at, updated_by
            `;

            const result = await this.query(insertQuery, [userId, roleId, updatedBy]);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to assign role'
                };
            }

            return {
                success: true,
                data: {
                    ...result.data[0],
                    role: roleCheck.data[0]
                }
            };
        } catch (error) {
            console.error('Error in assignRole:', error);
            return {
                success: false,
                error: 'Failed to assign role'
            };
        }
    };

    /**
     * Remove a role from a user
     * @param {number} userId - User ID
     * @param {number} roleId - Role ID
     * @param {number} updatedBy - ID of user performing the removal
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    removeRole = async (userId, roleId, updatedBy) => {
        try {
            if (!userId || !roleId) {
                return {
                    success: false,
                    error: 'User ID and Role ID are required'
                };
            }

            // Check if user has this role
            const existingCheck = await this.query(
                'SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2',
                [userId, roleId]
            );

            if (!existingCheck.success || existingCheck.data.length === 0) {
                return {
                    success: false,
                    error: 'User does not have this role'
                };
            }

            // Prevent removing the last super admin (must always have at least one user with super_admin role)
            const roleNameCheck = await this.query('SELECT name FROM roles WHERE id = $1', [roleId]);
            if (roleNameCheck.success && roleNameCheck.data.length > 0 && roleNameCheck.data[0].name === SUPER_ADMIN_ROLE_NAME) {
                const countResult = await this.query(
                    'SELECT COUNT(*)::int AS count FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name = $1',
                    [SUPER_ADMIN_ROLE_NAME]
                );
                const count = countResult.success && countResult.data.length > 0 ? parseInt(countResult.data[0].count, 10) : 0;
                if (count <= 1) {
                    return {
                        success: false,
                        error: 'Cannot remove the last super admin. At least one user must have the super admin role.'
                    };
                }
            }

            // Remove the role
            const deleteQuery = `
                DELETE FROM user_roles 
                WHERE user_id = $1 AND role_id = $2
                RETURNING id, user_id, role_id
            `;

            const result = await this.query(deleteQuery, [userId, roleId]);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to remove role'
                };
            }

            return {
                success: true,
                data: {
                    ...result.data[0],
                    removed_by: updatedBy
                }
            };
        } catch (error) {
            console.error('Error in removeRole:', error);
            return {
                success: false,
                error: 'Failed to remove role'
            };
        }
    };

    // ========================================
    // ROLE CRUD METHODS
    // ========================================

    /**
     * Get all roles
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    getAllRoles = async () => {
        try {
            const query = `
                SELECT 
                    id,
                    name,
                    display_name,
                    description,
                    permissions,
                    created_at,
                    updated_at
                FROM roles
                ORDER BY id
            `;

            const result = await this.query(query);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to fetch roles'
                };
            }

            return {
                success: true,
                data: result.data
            };
        } catch (error) {
            console.error('Error in getAllRoles:', error);
            return {
                success: false,
                error: 'Failed to fetch roles'
            };
        }
    };

    /**
     * Get a single role by ID
     * @param {number} roleId - Role ID
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    getRoleById = async (roleId) => {
        try {
            if (!roleId) {
                return {
                    success: false,
                    error: 'Role ID is required'
                };
            }

            const query = `
                SELECT 
                    id,
                    name,
                    display_name,
                    description,
                    permissions,
                    created_at,
                    updated_at
                FROM roles
                WHERE id = $1
            `;

            const result = await this.query(query, [roleId]);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to fetch role'
                };
            }

            if (result.data.length === 0) {
                return {
                    success: false,
                    error: 'Role not found'
                };
            }

            return {
                success: true,
                data: result.data[0]
            };
        } catch (error) {
            console.error('Error in getRoleById:', error);
            return {
                success: false,
                error: 'Failed to fetch role'
            };
        }
    };

    /**
     * Create a new role
     * @param {Object} roleData - Role data
     * @param {string} roleData.name - Role name (unique identifier)
     * @param {string} roleData.display_name - Display name
     * @param {string} roleData.description - Role description
     * @param {string[]} roleData.permissions - Array of permission strings
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    createRole = async (roleData) => {
        try {
            const { name, display_name, description, permissions } = roleData;

            // Validate required fields
            if (!name || !display_name) {
                return {
                    success: false,
                    error: 'Role name and display name are required'
                };
            }

            // Validate permissions: only resource.manage.all are assignable
            if (permissions && Array.isArray(permissions)) {
                const validation = validatePermissions(permissions);
                if (!validation.valid) {
                    return {
                        success: false,
                        error: `Invalid permissions: ${validation.invalid.join(', ')}`
                    };
                }
                const allowedSet = new Set(getAssignablePermissions());
                const invalid = permissions.filter((p) => !allowedSet.has(p));
                if (invalid.length > 0) {
                    return {
                        success: false,
                        error: `Only resource.manage.all permissions are assignable. Invalid: ${invalid.join(', ')}`
                    };
                }
            }

            // Check if role name already exists
            const existingCheck = await this.query(
                'SELECT id FROM roles WHERE name = $1',
                [name]
            );

            if (existingCheck.success && existingCheck.data.length > 0) {
                return {
                    success: false,
                    error: 'Role name already exists'
                };
            }

            // Create the role
            const insertQuery = `
                INSERT INTO roles (name, display_name, description, permissions)
                VALUES ($1, $2, $3, $4)
                RETURNING id, name, display_name, description, permissions, created_at
            `;

            const result = await this.query(insertQuery, [
                name,
                display_name,
                description || null,
                JSON.stringify(permissions || [])
            ]);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to create role'
                };
            }

            return {
                success: true,
                data: result.data[0]
            };
        } catch (error) {
            console.error('Error in createRole:', error);
            return {
                success: false,
                error: 'Failed to create role'
            };
        }
    };

    /**
     * Update an existing role
     * @param {number} roleId - Role ID
     * @param {Object} roleData - Role data to update
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    updateRole = async (roleId, roleData) => {
        try {
            if (!roleId) {
                return {
                    success: false,
                    error: 'Role ID is required'
                };
            }

            const { name, display_name, description, permissions } = roleData;

            // Check if role exists
            const existingRole = await this.getRoleById(roleId);
            if (!existingRole.success) {
                return existingRole;
            }

            // Prevent modifying super admin role (name, display_name, description, permissions)
            if (existingRole.data.name === SUPER_ADMIN_ROLE_NAME) {
                return {
                    success: false,
                    error: 'Cannot modify super admin role'
                };
            }

            // Validate permissions if provided: only resource.manage.all or resource.manage.own are assignable
            if (permissions && Array.isArray(permissions)) {
                const validation = validatePermissions(permissions);
                if (!validation.valid) {
                    return {
                        success: false,
                        error: `Invalid permissions: ${validation.invalid.join(', ')}`
                    };
                }
                const allowedSet = new Set(getAssignablePermissions());
                const invalid = permissions.filter((p) => !allowedSet.has(p));
                if (invalid.length > 0) {
                    return {
                        success: false,
                        error: `Only resource.manage.all permissions are assignable. Invalid: ${invalid.join(', ')}`
                    };
                }
            }

            // Build update query dynamically
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (name !== undefined) {
                updates.push(`name = $${paramCount++}`);
                values.push(name);
            }
            if (display_name !== undefined) {
                updates.push(`display_name = $${paramCount++}`);
                values.push(display_name);
            }
            if (description !== undefined) {
                updates.push(`description = $${paramCount++}`);
                values.push(description);
            }
            if (permissions !== undefined) {
                updates.push(`permissions = $${paramCount++}`);
                values.push(JSON.stringify(permissions));
            }

            if (updates.length === 0) {
                return {
                    success: false,
                    error: 'No fields to update'
                };
            }

            values.push(roleId);

            const updateQuery = `
                UPDATE roles
                SET ${updates.join(', ')}
                WHERE id = $${paramCount}
                RETURNING id, name, display_name, description, permissions, updated_at
            `;

            const result = await this.query(updateQuery, values);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to update role'
                };
            }

            return {
                success: true,
                data: result.data[0]
            };
        } catch (error) {
            console.error('Error in updateRole:', error);
            return {
                success: false,
                error: 'Failed to update role'
            };
        }
    };

    /**
     * Delete a role
     * Prevents deletion of system roles and roles assigned to users
     * @param {number} roleId - Role ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    deleteRole = async (roleId) => {
        try {
            if (!roleId) {
                return {
                    success: false,
                    error: 'Role ID is required'
                };
            }

            // Check if role exists
            const existingRole = await this.getRoleById(roleId);
            if (!existingRole.success) {
                return existingRole;
            }

            // Prevent deletion of system roles (including super_admin - non-deletable)
            const systemRoles = ['admin', 'moderator', 'student', 'teacher', SUPER_ADMIN_ROLE_NAME];
            if (systemRoles.includes(existingRole.data.name)) {
                return {
                    success: false,
                    error: 'Cannot delete system roles'
                };
            }

            // Check if role is assigned to any users
            const usageCheck = await this.query(
                'SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1',
                [roleId]
            );

            if (usageCheck.success && parseInt(usageCheck.data[0].count) > 0) {
                return {
                    success: false,
                    error: 'Cannot delete role that is assigned to users'
                };
            }

            // Delete the role
            const deleteQuery = 'DELETE FROM roles WHERE id = $1';
            const result = await this.query(deleteQuery, [roleId]);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to delete role'
                };
            }

            return {
                success: true
            };
        } catch (error) {
            console.error('Error in deleteRole:', error);
            return {
                success: false,
                error: 'Failed to delete role'
            };
        }
    };
}

module.exports = { RoleService };
