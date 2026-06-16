const { RoleService } = require('../service/managerial/roleService');
const { Service } = require('../service/base');

/**
 * Course-scoped access helper functions
 * 
 * These helpers provide two distinct patterns for course-scoped access control:
 * 1. checkCourseAccess - For single-resource access checks (blocking operations)
 * 2. getAccessibleCourseIds - For list-level filtering (query filtering operations)
 * 3. resolveCourseId - Resolve courseId from any resource type and ID
 * 4. assertCourseAccess - Combines resolveCourseId + hasScopeAccess in one call
 */

/**
 * Check if user has access to a specific course
 * Use for blocking operations (update/delete specific resource)
 * 
 * @param {number} userId - User ID
 * @param {string} resource - Resource name (e.g., 'announcement', 'revenue')
 * @param {string} action - Action name (e.g., 'manage')
 * @param {number} courseId - Specific course ID to check (required)
 * @returns {Promise<{hasAccess: boolean, reason: string}>}
 * 
 * @example
 * // Check if user can update a specific course
 * const access = await checkCourseAccess(userId, 'course', 'manage', courseId);
 * if (!access.hasAccess) {
 *     return res.status(403).json({ error: 'NO_COURSE_ACCESS' });
 * }
 */
const checkCourseAccess = async (userId, resource, action, courseId) => {
    try {
        if (!userId || !resource || !action || courseId === undefined || courseId === null) {
            return {
                hasAccess: false,
                reason: 'Missing required parameters'
            };
        }

        const roleService = new RoleService();
        const permissionsResult = await roleService.getUserPermissions(userId);

        if (!permissionsResult.success) {
            return {
                hasAccess: false,
                reason: permissionsResult.error || 'Failed to check access'
            };
        }

        const userPermissions = permissionsResult.data;
        const globalPermission = `${resource}.${action}.all`;
        const hasAccess = userPermissions.includes(globalPermission);

        return {
            hasAccess,
            reason: hasAccess ? 'Access granted' : 'Access denied'
        };
    } catch (error) {
        console.error('Error in checkCourseAccess:', error);
        return {
            hasAccess: false,
            reason: 'Internal error checking course access'
        };
    }
};

/**
 * Get list of course IDs user has access to
 * Use for filtering list/aggregate queries
 * 
 * @param {number} userId - User ID
 * @param {string} resource - Resource name (e.g., 'analytics', 'revenue')
 * @param {string} action - Action name (e.g., 'manage')
 * @returns {Promise<{hasGlobalAccess: boolean, courseIds?: number[]}>}
 * 
 * @example
 * // Filter analytics query by accessible courses
 * const access = await getAccessibleCourseIds(userId, 'analytics', 'manage');
 * let query = 'SELECT * FROM analytics';
 * let params = [];
 * if (!access.hasGlobalAccess) {
 *     query += ' WHERE course_id = ANY($1)';
 *     params = [access.courseIds];
 * }
 */
const getAccessibleCourseIds = async (userId, resource, action) => {
    try {
        if (!userId || !resource || !action) {
            return {
                hasGlobalAccess: false,
                courseIds: []
            };
        }

        const roleService = new RoleService();
        
        // Get user permissions
        const permissionsResult = await roleService.getUserPermissions(userId);
        
        if (!permissionsResult.success) {
            return {
                hasGlobalAccess: false,
                courseIds: []
            };
        }

        const userPermissions = permissionsResult.data;
        const globalPermission = `${resource}.${action}.all`;

        if (userPermissions.includes(globalPermission)) {
            return { hasGlobalAccess: true };
        }

        return { hasGlobalAccess: false, courseIds: [] };
    } catch (error) {
        console.error('Error in getAccessibleCourseIds:', error);
        return {
            hasGlobalAccess: false,
            courseIds: []
        };
    }
};

/**
 * Resolve courseId from any resource type and ID
 * Handles both direct (chapter → course_id) and nested (module → chapter → course_id) lookups
 * 
 * @param {string} resourceType - Resource type: 'announcement', 'chapter', 'module', 'routine', etc.
 * @param {number} resourceId - Resource ID
 * @returns {Promise<number|null>} courseId or null if not found
 * 
 * @example
 * // Resolve courseId from a module
 * const courseId = await resolveCourseId('module', moduleId);
 * if (!courseId) {
 *     return res.status(404).json({ error: 'Module not found' });
 * }
 */
const resolveCourseId = async (resourceType, resourceId) => {
    try {
        if (!resourceType || !resourceId) {
            return null;
        }

        // Map of resource types to SQL queries for courseId lookup
        const queries = {
            announcement: 'SELECT course_id FROM announcements WHERE id = $1',
            chapter: 'SELECT course_id FROM chapter WHERE id = $1',
            routine: 'SELECT course_id FROM course_routine WHERE id = $1',
            // Multi-hop lookups for nested resources
            module: `
                SELECT c.course_id 
                FROM module m 
                JOIN chapter c ON m.chapter_id = c.id 
                WHERE m.id = $1
            `,
        };

        const query = queries[resourceType];
        if (!query) {
            console.error(`Unknown resourceType: ${resourceType}`);
            return null;
        }

        // Use Service base class to execute query
        const service = new Service();
        const result = await service.query(query, [resourceId]);

        if (!result.success || !result.data || result.data.length === 0) {
            return null;
        }

        return result.data[0].course_id || null;
    } catch (error) {
        console.error('Error in resolveCourseId:', error);
        return null;
    }
};

/**
 * Resolve courseId and check access in one call
 * Combines resolveCourseId + hasScopeAccess for controller convenience
 * 
 * @param {number} userId - User ID
 * @param {string} resource - Resource name for permission check (e.g., 'announcement')
 * @param {string} action - Action name (e.g., 'manage')
 * @param {string} resourceType - Resource type for lookup (usually same as resource)
 * @param {number} resourceId - Resource ID to lookup
 * @returns {Promise<{hasAccess: boolean, reason: string, courseId?: number}>}
 * 
 * @example
 * // Check access to update an announcement
 * const access = await assertCourseAccess(
 *     userId, 
 *     'announcement', 
 *     'manage', 
 *     'announcement', 
 *     announcementId
 * );
 * if (!access.hasAccess) {
 *     return res.status(403).json({ 
 *         success: false, 
 *         error: 'NO_COURSE_ACCESS',
 *         reason: access.reason 
 *     });
 * }
 */
const assertCourseAccess = async (userId, resource, action, resourceType, resourceId) => {
    try {
        if (!userId || !resource || !action || !resourceType || !resourceId) {
            return {
                hasAccess: false,
                reason: 'Missing required parameters'
            };
        }

        // Resolve courseId from resource
        const courseId = await resolveCourseId(resourceType, resourceId);

        if (!courseId) {
            return {
                hasAccess: false,
                reason: 'resource_not_found'
            };
        }

        const roleService = new RoleService();
        const permissionsResult = await roleService.getUserPermissions(userId);

        if (!permissionsResult.success) {
            return {
                hasAccess: false,
                reason: permissionsResult.error || 'Failed to check access',
                courseId
            };
        }

        const userPermissions = permissionsResult.data;
        const globalPermission = `${resource}.${action}.all`;
        const hasAccess = userPermissions.includes(globalPermission);

        return {
            hasAccess,
            reason: hasAccess ? 'Access granted' : 'Access denied',
            courseId
        };
    } catch (error) {
        console.error('Error in assertCourseAccess:', error);
        return {
            hasAccess: false,
            reason: 'Internal error checking course access'
        };
    }
};

module.exports = {
    checkCourseAccess,
    getAccessibleCourseIds,
    resolveCourseId,
    assertCourseAccess
};
