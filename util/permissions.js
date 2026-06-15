/**
 * RBAC Permissions - Single Source of Truth
 *
 * This file defines ALL valid permissions in the system.
 * Permissions follow the pattern: resource.action.scope
 *
 * Scopes:
 * - .all  = Access to all resources (only supported scope)
 *
 * Usage:
 * const { PERMISSIONS } = require('./util/permissions');
 * requirePermission(PERMISSIONS.USER.READ.ALL)
 * 
 * DO NOT hardcode permission strings elsewhere in the codebase.
 * Always import from this file.
 */

const PERMISSIONS = {
  // ========================================
  // USER PERMISSIONS
  // ========================================
  USER: {
    CREATE: {
      ALL: 'user.create.all'
    },
    READ: {
      ALL: 'user.read.all'
    },
    UPDATE: {
      ALL: 'user.update.all'
    },
    DELETE: {
      ALL: 'user.delete.all'
    },
    MANAGE: {
      ALL: 'user.manage.all'  // Phase 5: Primary permission for all user operations
    }
  },

  // ========================================
  // COURSE PERMISSIONS
  // ========================================
  COURSE: {
    CREATE: {
      ALL: 'course.create.all'
    },
    READ: {
      ALL: 'course.read.all'
    },
    UPDATE: {
      ALL: 'course.update.all'
    },
    DELETE: {
      ALL: 'course.delete.all'
    },
    MANAGE: {
      ALL: 'course.manage.all'
    },
    // Course-specific permissions
    // These are for shareholders/owners who have access to specific courses only
    VIEW: 'course.view',              // View basic course info (course-specific)
    EDIT: 'course.edit',              // Edit specific course (course-specific)
    MANAGE_SPECIFIC: 'course.manage'  // Full management of specific course (course-specific)
  },

  // ========================================
  // COURSE-SPECIFIC ACCESS PERMISSIONS (Phase 2)
  // ========================================
  COURSE_ACCESS: {
    VIEW: {
      COURSE: 'course.view',
    },
    ENROLLMENT: {
      VIEW: 'enrollment.view',
    },
    MODULE: {
      VIEW: 'module.view',
    },
    REVENUE: {
      VIEW: 'revenue.view',
    },
    ANALYTICS: {
      VIEW: 'analytics.view',
    },
    MANAGE: {
      COURSE: 'course.manage'
    }
  },

  // ========================================
  // CHAPTER PERMISSIONS (child of COURSE)
  // ========================================
  CHAPTER: {
    CREATE: {
      ALL: 'chapter.create.all'
    },
    READ: {
      ALL: 'chapter.read.all'
    },
    UPDATE: {
      ALL: 'chapter.update.all'
    },
    DELETE: {
      ALL: 'chapter.delete.all'
    },
    MANAGE: {
      ALL: 'chapter.manage.all'
    }
  },

  // ========================================
  // MODULE PERMISSIONS (child of CHAPTER/COURSE)
  // ========================================
  MODULE: {
    CREATE: {
      ALL: 'module.create.all'
    },
    READ: {
      ALL: 'module.read.all'
    },
    UPDATE: {
      ALL: 'module.update.all'
    },
    DELETE: {
      ALL: 'module.delete.all'
    },
    MANAGE: {
      ALL: 'module.manage.all'
    }
  },

  // ========================================
  // QUIZ PERMISSIONS (child of COURSE)
  // ========================================
  QUIZ: {
    CREATE: {
      ALL: 'quiz.create.all'
    },
    READ: {
      ALL: 'quiz.read.all'
    },
    UPDATE: {
      ALL: 'quiz.update.all'
    },
    DELETE: {
      ALL: 'quiz.delete.all'
    },
    MANAGE: {
      ALL: 'quiz.manage.all'
    }
  },

  // ========================================
  // SUBMISSION PERMISSIONS (child of COURSE)
  // ========================================
  SUBMISSION: {
    READ: {
      ALL: 'submission.read.all'
    },
    UPDATE: {
      ALL: 'submission.update.all'
    },
    MANAGE: {
      ALL: 'submission.manage.all'
    }
  },

  // ========================================
  // CONTEST PERMISSIONS (child of COURSE)
  // ========================================
  CONTEST: {
    CREATE: {
      ALL: 'contest.create.all'
    },
    READ: {
      ALL: 'contest.read.all'
    },
    UPDATE: {
      ALL: 'contest.update.all'
    },
    DELETE: {
      ALL: 'contest.delete.all'
    },
    MANAGE: {
      ALL: 'contest.manage.all'
    }
  },

  // ========================================
  // ANNOUNCEMENT PERMISSIONS (child of COURSE)
  // ========================================
  ANNOUNCEMENT: {
    CREATE: {
      ALL: 'announcement.create.all'
    },
    READ: {
      ALL: 'announcement.read.all'
    },
    UPDATE: {
      ALL: 'announcement.update.all'
    },
    DELETE: {
      ALL: 'announcement.delete.all'
    },
    SEND: {
      ALL: 'announcement.send.all'
    },
    MANAGE: {
      ALL: 'announcement.manage.all'
    }
  },

  // ========================================
  // LIVE SESSION PERMISSIONS (child of COURSE)
  // ========================================
  LIVE: {
    CREATE: {
      ALL: 'live.create.all'
    },
    READ: {
      ALL: 'live.read.all'
    },
    UPDATE: {
      ALL: 'live.update.all'
    },
    DELETE: {
      ALL: 'live.delete.all'
    },
    IMPORT: {
      ALL: 'live.import.all'
    },
    EXPORT: {
      ALL: 'live.export.all'
    },
    MANAGE: {
      ALL: 'live.manage.all'
    }
  },

  // ========================================
  // BUNDLE PERMISSIONS
  // ========================================
  BUNDLE: {
    CREATE: {
      ALL: 'bundle.create.all'
    },
    READ: {
      ALL: 'bundle.read.all'
    },
    UPDATE: {
      ALL: 'bundle.update.all'
    },
    DELETE: {
      ALL: 'bundle.delete.all'
    },
    MANAGE: {
      ALL: 'bundle.manage.all'
    },
    ANALYTICS: {
      ALL: 'bundle.analytics.all'
    },
    EXPORT: {
      ALL: 'bundle.export.all'
    },
    PREBOOKING: {
      ALL: 'bundle.prebooking.all'
    }
  },

  // ========================================
  // BOOK PERMISSIONS (book catalogue)
  // ========================================
  BOOK: {
    CREATE: {
      ALL: 'book.create.all'
    },
    READ: {
      ALL: 'book.read.all'
    },
    UPDATE: {
      ALL: 'book.update.all'
    },
    DELETE: {
      ALL: 'book.delete.all'
    },
    MANAGE: {
      ALL: 'book.manage.all'
    },
    ANALYTICS: {
      ALL: 'book.analytics.all'
    }
  },

  // ========================================
  // COUPON PERMISSIONS
  // ========================================
  COUPON: {
    CREATE: {
      ALL: 'coupon.create.all'
    },
    READ: {
      ALL: 'coupon.read.all'
    },
    UPDATE: {
      ALL: 'coupon.update.all'
    },
    DELETE: {
      ALL: 'coupon.delete.all'
    },
    MANAGE: {
      ALL: 'coupon.manage.all'   // Coupons are not course-scoped, only .all permission
    },
    ANALYTICS: {
      ALL: 'coupon.analytics.all'
    }
  },

  // ========================================
  // ADMIN PERMISSIONS
  // ========================================
  ADMIN: {
    CREATE: {
      ALL: 'admin.create.all'
    },
    READ: {
      ALL: 'admin.read.all'
    },
    UPDATE: {
      ALL: 'admin.update.all'
    },
    DELETE: {
      ALL: 'admin.delete.all'
    },
    PASSWORD: {
      SET: 'admin.password.set'
    },
    MANAGE: {
      ALL: 'admin.manage.all'  // Phase 5: Primary permission for all admin operations
    }
  },

  // ========================================
  // TEACHER PERMISSIONS
  // ========================================
  TEACHER: {
    CREATE: {
      ALL: 'teacher.create.all'
    },
    READ: {
      ALL: 'teacher.read.all'
    },
    UPDATE: {
      ALL: 'teacher.update.all'
    },
    DELETE: {
      ALL: 'teacher.delete.all'
    },
    PASSWORD: {
      RESET: 'teacher.password.reset'
    },
    MANAGE: {
      ALL: 'teacher.manage.all'
    }
  },

  // ========================================
  // REVENUE PERMISSIONS
  // ========================================
  // ========================================
  // REVENUE PERMISSIONS
  // Supports hybrid access permission naming
  // ========================================
  REVENUE: {
    READ: {
      ALL: 'revenue.read.all',
    },
    MANAGE: {
      ALL: 'revenue.manage.all'
    }
  },
  // ========================================
  // ENROLLMENT PERMISSIONS
  // ========================================
  ENROLLMENT: {
    READ: {
      ALL: 'enrollment.read.all'
    }
  },

  // ========================================
  // PREBOOKING PERMISSIONS
  // ========================================
  PREBOOKING: {
    READ: {
      ALL: 'prebooking.read.all'
    },
    UPDATE: {
      ALL: 'prebooking.update.all'
    },
    DELETE: {
      ALL: 'prebooking.delete.all'
    }
  },

  // ========================================
  // PROGRESS PERMISSIONS
  // ========================================
  PROGRESS: {
    READ: {
      ALL: 'progress.read.all'
    }
  },

  // ========================================
  // PAYMENT PERMISSIONS
  // ========================================
  PAYMENT: {
    AUDIT: {
      READ: 'payment.audit.read',
      EXPORT: 'payment.audit.export'
    },
    RECONCILE: {
      ALL: 'payment.reconcile.all'
    },
    MANAGE: {
      ALL: 'payment.manage.all'
    }
  },

  // ========================================
  // FEEDBACK PERMISSIONS
  // ========================================
  FEEDBACK: {
    READ: {
      ALL: 'feedback.read.all'
    },
    DELETE: {
      ALL: 'feedback.delete.all'
    },
    ANALYTICS: {
      ALL: 'feedback.analytics.all'
    },
    EXPORT: {
      ALL: 'feedback.export.all'
    },
    MANAGE: {
      ALL: 'feedback.manage.all'
    }
  },

  // ========================================
  // USER SPECIFIC PERMISSIONS
  // ========================================
  USER_PASSWORD: {
    RESET: 'user.password.reset'
  },

  // ========================================
  // SMS PERMISSIONS
  // ========================================
  SMS: {
    SEND: {
      ALL: 'sms.send.all'
    },
    READ: {
      ALL: 'sms.read.all'
    },
    ANALYTICS: {
      ALL: 'sms.analytics.all'
    },
    MANAGE: {
      ALL: 'sms.manage.all'
    }
  },

  // ========================================
  // ANALYTICS PERMISSIONS
  // ========================================
  // ========================================
  // ANALYTICS PERMISSIONS
  // Supports hybrid access permission naming
  // ========================================
  ANALYTICS: {
    READ: {
      ALL: 'analytics.read.all',
    },
    MANAGE: {
      ALL: 'analytics.manage.all'
    }
  },

  // ========================================
  // MESSAGE PERMISSIONS (After-purchase messages)
  // ========================================
  MESSAGE: {
    CREATE: {
      ALL: 'message.create.all'
    },
    READ: {
      ALL: 'message.read.all'
    },
    UPDATE: {
      ALL: 'message.update.all'
    },
    DELETE: {
      ALL: 'message.delete.all'
    },
    MANAGE: {
      ALL: 'message.manage.all'
    }
  },

  // ========================================
  // STREAK PERMISSIONS (Learning streaks/gamification)
  // ========================================
  STREAK: {
    READ: {
      ALL: 'streak.read.all'
    },
    UPDATE: {
      ALL: 'streak.update.all'
    },
    ANALYTICS: {
      READ: 'streak.analytics.read'
    },
    LEADERBOARD: {
      READ: 'streak.leaderboard.read'
    },
    TRENDS: {
      READ: 'streak.trends.read'
    },
    BULK_UPDATE: {
      ALL: 'streak.bulk_update.all'
    },
    MANAGE: {
      ALL: 'streak.manage.all'
    }
  },

  // ========================================
  // ROUTINE PERMISSIONS
  // ========================================
  ROUTINE: {
    CREATE: {
      ALL: 'routine.create.all'
    },
    READ: {
      ALL: 'routine.read.all'
    },
    UPDATE: {
      ALL: 'routine.update.all'
    },
    DELETE: {
      ALL: 'routine.delete.all'
    },
    MANAGE: {
      ALL: 'routine.manage.all'
    }
  },

  // ========================================
  // LEVEL/GAMIFICATION PERMISSIONS
  // ========================================
  LEVEL: {
    CREATE: {
      ALL: 'level.create.all'
    },
    READ: {
      ALL: 'level.read.all'
    },
    UPDATE: {
      ALL: 'level.update.all'
    },
    DELETE: {
      ALL: 'level.delete.all'
    },
    APPROVE: {
      ALL: 'level.approve.all'
    },
    MANAGE: {
      ALL: 'level.manage.all'
    }
  },

  // ========================================
  // ROLE PERMISSIONS (for role management)
  // ========================================
  ROLE: {
    MANAGE: {
      ALL: 'role.manage.all'
    }
  }
};

/**
 * Get flat list of all permissions
 * Useful for validation and database seeding
 */
function getAllPermissions() {
  const permissions = [];
  
  function traverse(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        permissions.push(obj[key]);
      } else if (typeof obj[key] === 'object') {
        traverse(obj[key]);
      }
    }
  }
  
  traverse(PERMISSIONS);
  return permissions;
}

/**
 * Get only resource.manage.all permissions (Phase 5 simplified list).
 * Used for role create/edit UI and DB sync so only manage.all is assignable.
 */
function getManageAllPermissions() {
  const all = getAllPermissions();
  return all.filter((p) => typeof p === 'string' && p.endsWith('.manage.all'));
}

/**
 * Get assignable permissions for role management (only .manage.all)
 * These are the permissions actually used by API routes
 */
function getAssignablePermissions() {
  return getManageAllPermissions();
}

/**
 * Get manage.all permissions grouped by resource (for by_resource in permissions list API).
 * Only includes resources that have a .manage.all permission.
 */
function getManageAllPermissionsByResource() {
  const byResource = {};
  for (const key of Object.keys(PERMISSIONS)) {
    const resourcePerms = PERMISSIONS[key];
    if (!resourcePerms || typeof resourcePerms !== 'object') continue;
    const manageAll = resourcePerms.MANAGE && resourcePerms.MANAGE.ALL;
    if (typeof manageAll === 'string' && manageAll.endsWith('.manage.all')) {
      byResource[key] = [manageAll];
    }
  }
  return byResource;
}

/**
 * Get assignable permissions grouped by resource
 * Used for role management UI
 */
function getAssignablePermissionsByResource() {
  const byResource = {};
  for (const key of Object.keys(PERMISSIONS)) {
    const resourcePerms = PERMISSIONS[key];
    if (!resourcePerms || typeof resourcePerms !== 'object') continue;
    
    const permissions = [];
    const manageAll = resourcePerms.MANAGE && resourcePerms.MANAGE.ALL;
    if (typeof manageAll === 'string' && manageAll.endsWith('.manage.all')) {
      permissions.push(manageAll);
    }
    
    if (permissions.length > 0) {
      byResource[key] = permissions;
    }
  }
  return byResource;
}

/**
 * Validate if a permission string is valid
 * @param {string} permission - Permission string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidPermission(permission) {
  const allPermissions = getAllPermissions();
  return allPermissions.includes(permission);
}

/**
 * Get all permissions for a specific resource
 * @param {string} resource - Resource name (e.g., 'USER', 'COURSE')
 * @returns {string[]} - Array of permission strings
 */
function getResourcePermissions(resource) {
  const permissions = [];
  const resourcePerms = PERMISSIONS[resource];
  
  if (!resourcePerms) {
    return permissions;
  }
  
  function traverse(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        permissions.push(obj[key]);
      } else if (typeof obj[key] === 'object') {
        traverse(obj[key]);
      }
    }
  }
  
  traverse(resourcePerms);
  return permissions;
}

/**
 * Parse permission string into components
 * @param {string} permission - Permission string (e.g., 'user.read.all')
 * @returns {Object} - { resource, action, scope }
 */
function parsePermission(permission) {
  const parts = permission.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid permission format: ${permission}. Expected: resource.action.scope`);
  }
  
  return {
    resource: parts[0],
    action: parts[1],
    scope: parts[2]
  };
}

/**
 * Validate array of permissions
 * @param {string[]} permissions - Array of permission strings
 * @returns {Object} - { valid: boolean, invalid: string[] }
 */
function validatePermissions(permissions) {
  const allValid = getAllPermissions();
  const invalid = permissions.filter(p => !allValid.includes(p));
  
  return {
    valid: invalid.length === 0,
    invalid: invalid
  };
}

// ========================================
// HIERARCHICAL PERMISSION SUPPORT (NOT USED FOR AUTHORIZATION)
// ========================================
// Authorization is explicit-only: each route requires the exact permission.
// These helpers are kept for reference, display, or tests only.

/**
 * Resource hierarchy map (reference only; not used for route authorization)
 */
const RESOURCE_HIERARCHY = {
  // Course is parent of many resources
  'chapter': 'course',
  'module': 'course',
  'quiz': 'course',
  'submission': 'course',
  'contest': 'course',
  'announcement': 'course',
  'live': 'course',
  'routine': 'course',     // NEW: Routines/schedules belong to courses
  'level': 'course',       // NEW: Gamification levels belong to courses
};

/**
 * Get parent resource in hierarchy
 * @param {string} resource - Child resource name
 * @returns {string|null} - Parent resource name or null
 */
function getParentResource(resource) {
  return RESOURCE_HIERARCHY[resource] || null;
}

/**
 * Get all parent resources recursively
 * @param {string} resource - Resource name
 * @returns {string[]} - Array of parent resources (immediate to root)
 */
function getParentChain(resource) {
  const parents = [];
  let current = resource;
  
  while (current) {
    const parent = getParentResource(current);
    if (parent) {
      parents.push(parent);
      current = parent;
    } else {
      break;
    }
  }
  
  return parents;
}

/**
 * Check if user has permission with hierarchical support
 * @param {string[]} userPermissions - User's permissions array
 * @param {string} requiredPermission - Required permission (e.g., 'chapter.read.all')
 * @param {Object} context - Additional context (optional)
 * @returns {boolean}
 */
function hasHierarchicalPermission(userPermissions, requiredPermission, context = {}) {
  // Handle null/undefined/empty permissions
  if (!userPermissions || !Array.isArray(userPermissions) || userPermissions.length === 0) {
    return false;
  }
  
  // 1. Direct permission check
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }
  
  try {
    // 2. Parse required permission
    const { resource, action, scope } = parsePermission(requiredPermission);
    
    // 3. Check parent permissions recursively
    const parents = getParentChain(resource);
    
    for (const parentResource of parents) {
      // Check if user has parent's manage permission (manage grants all actions)
      const parentManagePermission = `${parentResource}.manage.${scope}`;
      if (userPermissions.includes(parentManagePermission)) {
        return true;
      }
      
      // Check if user has parent's specific action permission
      const parentActionPermission = `${parentResource}.${action}.${scope}`;
      if (userPermissions.includes(parentActionPermission)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    // Silently return false for invalid permissions
    return false;
  }
}

/**
 * Get all permissions that would grant access to a resource
 * Useful for debugging and documentation
 * @param {string} permission - Target permission
 * @returns {string[]} - Array of permissions that would grant access
 */
function getEquivalentPermissions(permission) {
  const equivalents = [permission];
  
  try {
    const { resource, action, scope } = parsePermission(permission);
    const parents = getParentChain(resource);
    
    for (const parentResource of parents) {
      // Parent's manage permission
      equivalents.push(`${parentResource}.manage.${scope}`);
      
      // Parent's specific action permission
      equivalents.push(`${parentResource}.${action}.${scope}`);
    }
    
    return equivalents;
  } catch {
    return equivalents;
  }
}

/**
 * Check if a permission grants access to child resources
 * @param {string} permission - Permission to check
 * @returns {string[]} - Array of child resources this permission grants access to
 */
function getChildResources(permission) {
  try {
    const { resource } = parsePermission(permission);
    const children = [];
    
    // Find all resources that have this resource as parent
    for (const [child, parent] of Object.entries(RESOURCE_HIERARCHY)) {
      if (parent === resource) {
        children.push(child);
      }
    }
    
    return children;
  } catch {
    return [];
  }
}

/**
 * Expand permissions to include all hierarchically granted permissions
 * Useful for displaying "effective permissions" to users
 * @param {string[]} userPermissions - User's direct permissions
 * @returns {string[]} - All effective permissions (direct + inherited)
 */
function expandPermissions(userPermissions) {
  const expanded = new Set(userPermissions);
  
  for (const permission of userPermissions) {
    try {
      const { resource, action, scope } = parsePermission(permission);
      const children = getChildResources(permission);
      
      // If this is a manage permission, add all actions for children
      if (action === 'manage') {
        const actions = ['create', 'read', 'update', 'delete'];
        for (const child of children) {
          for (const childAction of actions) {
            expanded.add(`${child}.${childAction}.${scope}`);
          }
          // Also add manage for children
          expanded.add(`${child}.manage.${scope}`);
        }
      } else {
        // Add same action for all children
        for (const child of children) {
          expanded.add(`${child}.${action}.${scope}`);
        }
      }
    } catch {
      // Skip invalid permissions
      continue;
    }
  }
  
  return Array.from(expanded);
}

// Export all permissions as flat array (for database validation)
const ALL_PERMISSIONS = getAllPermissions();

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  RESOURCE_HIERARCHY,
  isValidPermission,
  getAllPermissions,
  getManageAllPermissions,
  getAssignablePermissions,
  getManageAllPermissionsByResource,
  getAssignablePermissionsByResource,
  getResourcePermissions,
  parsePermission,
  validatePermissions,
  // Hierarchical permission functions
  getParentResource,
  getParentChain,
  hasHierarchicalPermission,
  getEquivalentPermissions,
  getChildResources,
  expandPermissions
};
