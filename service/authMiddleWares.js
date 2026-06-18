const jwt = require('jsonwebtoken');
const { managerialAccountTypes } = require('../util/constants');
const { PERMISSIONS } = require('../util/permissions');
const { Service } = require('./base');

const sessionStore = new Service();

// For regular users (type=3), tokens carry a session id (sid) tracked server-side
// to enforce the max-device limit. Returns true if the session is still active.
// Tokens without a sid (e.g. legacy tokens issued before sessions) are allowed
// through so existing logins are not invalidated.
const isSessionActive = async (decoded) => {
    if (decoded.type !== managerialAccountTypes.regular) return true;
    if (!decoded.sid) return true;
    const result = await sessionStore.query(
        `SELECT 1 FROM auth_session WHERE user_id = $1 AND session_id = $2 LIMIT 1`,
        [parseInt(decoded.id), decoded.sid]
    );
    return result.success && result.data.length > 0;
};

// ========================================
// LEGACY MIDDLEWARE (Type-based)
// ========================================

var authenticateAdmin=(req, res, next)=>{
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return res.sendStatus(401)
    try{
        var decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(decoded.type!==managerialAccountTypes.admin && decoded.type!==managerialAccountTypes.moderator)return res.sendStatus(403)
        req.body['user_id']=parseInt(decoded.id)
        req.body['user_type']=decoded.type
        req.user = decoded; // Add decoded token to req.user for permission checks
        next()
    }catch(err){
        return res.sendStatus(403)
    }
}

var authenticateUser=async (req, res, next)=>{
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return res.sendStatus(401)
    try{
        var decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(decoded.type!==managerialAccountTypes.regular) {
            return res.sendStatus(403)
        }
        if (!(await isSessionActive(decoded))) {
            return res.status(401).json({
                success: false,
                message: 'Session ended. Please log in again.',
                error: 'SESSION_REVOKED'
            })
        }
        req.user = decoded;
        req.body['user_id']=parseInt(decoded.id)
        next()
    }catch(err){
        return res.sendStatus(403)
    }
}

var optAuthenticateUser=(req, res, next)=>{
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) { req.body['auth']=false; req.body['auth_error']='no_token' }
    else{
        try{
            var decoded=jwt.verify(token, process.env.JWT_SECRET);
            req.body['auth']=true
            req.body['user_id']=parseInt(decoded.id)
        }catch(err){
            req.body['auth']=false
            // Distinguish an expired token from a malformed/wrong-signature one so
            // callers can surface a meaningful message instead of a generic one.
            req.body['auth_error'] = err.name === 'TokenExpiredError' ? 'expired' : 'invalid'
        }
    }
    next()
    
}

var authenticateInv=(req, res, next)=>{
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return res.sendStatus(401)
    try{
        var decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.body['user_id']=parseInt(decoded.id)
        next()
    }catch(err){
        return res.sendStatus(403)
    }
}

// ========================================
// RBAC MIDDLEWARE (Permission-based)
// ========================================

/**
 * Require a single permission
 * @param {string} permission - Permission string (e.g., 'user.read.all')
 * @returns {Function} Express middleware
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                error: 'NO_TOKEN'
            });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if permissions array exists in token
            if (!decoded.permissions || !Array.isArray(decoded.permissions)) {
                return res.status(403).json({
                    success: false,
                    message: 'No permissions found in token',
                    error: 'NO_PERMISSIONS'
                });
            }
            
            // Check if user has the required permission
            if (!decoded.permissions.includes(permission)) {
                return res.status(403).json({
                    success: false,
                    message: `Permission denied: ${permission} required`,
                    error: 'INSUFFICIENT_PERMISSIONS',
                    required: permission
                });
            }
            
            // Attach decoded token to request
            req.user = decoded;
            req.body['user_id'] = parseInt(decoded.id);
            req.body['user_type'] = decoded.type;
            
            next();
        } catch (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token',
                error: 'INVALID_TOKEN'
            });
        }
    };
};

/**
 * Require ANY of the specified permissions
 * @param {string[]} permissions - Array of permission strings
 * @returns {Function} Express middleware
 */
const requireAnyPermission = (permissions) => {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                error: 'NO_TOKEN'
            });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (!decoded.permissions || !Array.isArray(decoded.permissions)) {
                return res.status(403).json({
                    success: false,
                    message: 'No permissions found in token',
                    error: 'NO_PERMISSIONS'
                });
            }
            
            // Check if user has ANY of the required permissions
            const hasPermission = permissions.some(p => decoded.permissions.includes(p));
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: `Permission denied: One of [${permissions.join(', ')}] required`,
                    error: 'INSUFFICIENT_PERMISSIONS',
                    required: permissions
                });
            }
            
            req.user = decoded;
            req.body['user_id'] = parseInt(decoded.id);
            req.body['user_type'] = decoded.type;
            
            next();
        } catch (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token',
                error: 'INVALID_TOKEN'
            });
        }
    };
};

/**
 * Require ALL of the specified permissions
 * @param {string[]} permissions - Array of permission strings
 * @returns {Function} Express middleware
 */
const requireAllPermissions = (permissions) => {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                error: 'NO_TOKEN'
            });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (!decoded.permissions || !Array.isArray(decoded.permissions)) {
                return res.status(403).json({
                    success: false,
                    message: 'No permissions found in token',
                    error: 'NO_PERMISSIONS'
                });
            }
            
            // Check if user has ALL required permissions
            const missingPermissions = permissions.filter(p => !decoded.permissions.includes(p));
            
            if (missingPermissions.length > 0) {
                return res.status(403).json({
                    success: false,
                    message: `Permission denied: Missing permissions [${missingPermissions.join(', ')}]`,
                    error: 'INSUFFICIENT_PERMISSIONS',
                    required: permissions,
                    missing: missingPermissions
                });
            }
            
            req.user = decoded;
            req.body['user_id'] = parseInt(decoded.id);
            req.body['user_type'] = decoded.type;
            
            next();
        } catch (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token',
                error: 'INVALID_TOKEN'
            });
        }
    };
};

/**
 * Require scope-based access
 * @param {string} resource - Resource name (e.g., 'user', 'course')
 * @param {string} action - Action name (e.g., 'read', 'update')
 * @param {Function} getResourceOwnerId - Optional function to extract resource owner ID from request
 * @returns {Function} Express middleware
 */
const requireScopeAccess = (resource, action, getResourceOwnerId) => {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                error: 'NO_TOKEN'
            });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (!decoded.permissions || !Array.isArray(decoded.permissions)) {
                return res.status(403).json({
                    success: false,
                    message: 'No permissions found in token',
                    error: 'NO_PERMISSIONS'
                });
            }
            
            const globalPermission = `${resource}.${action}.all`;

            if (decoded.permissions.includes(globalPermission)) {
                req.user = decoded;
                req.body['user_id'] = parseInt(decoded.id);
                req.body['user_type'] = decoded.type;
                return next();
            }

            return res.status(403).json({
                success: false,
                message: `Permission denied: ${resource}.${action}.all required`,
                error: 'INSUFFICIENT_PERMISSIONS',
                required: [globalPermission]
            });
            
        } catch (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token',
                error: 'INVALID_TOKEN'
            });
        }
    };
};

/**
 * Basic authentication - just verify token and attach user
 * @returns {Function} Express middleware
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: 'NO_TOKEN'
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.body['user_id'] = parseInt(decoded.id);
        req.body['user_type'] = decoded.type;
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token',
            error: 'INVALID_TOKEN'
        });
    }
};

/**
 * Require course-related access (middleware)
 * Requires resource.action.all permission.
 *
 * @param {string} resource - Resource name (e.g., 'revenue', 'course')
 * @param {string} action - Action name (e.g., 'manage')
 * @param {Function} getCourseId - Unused; kept for call-site compatibility
 * @returns {Function} Express middleware
 */
const requireCourseAccess = (resource, action, getCourseId) => {
    return async (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                error: 'NO_TOKEN'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (!decoded.permissions || !Array.isArray(decoded.permissions)) {
                return res.status(403).json({
                    success: false,
                    message: 'No permissions found in token',
                    error: 'NO_PERMISSIONS'
                });
            }

            const globalPermission = `${resource}.${action}.all`;

            if (decoded.permissions.includes(globalPermission)) {
                req.user = decoded;
                req.body['user_id'] = parseInt(decoded.id);
                req.body['user_type'] = decoded.type;
                return next();
            }

            return res.status(403).json({
                success: false,
                message: `Permission denied: ${resource}.${action}.all required`,
                error: 'INSUFFICIENT_PERMISSIONS',
                required: [globalPermission]
            });

        } catch (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token',
                error: 'INVALID_TOKEN'
            });
        }
    };
};

module.exports={
    // Legacy middleware (type-based)
    authenticateAdmin,
    authenticateUser,
    optAuthenticateUser,
    authenticateInv,
    
    // New RBAC middleware (permission-based)
    authenticate,
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireScopeAccess,
    requireCourseAccess,
    
    // Export PERMISSIONS for convenience
    PERMISSIONS
}
