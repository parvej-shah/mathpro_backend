const jwt = require('jsonwebtoken');
const { managerialAccountTypes } = require('../util/constants');
const { PERMISSIONS } = require('../util/permissions');
const { Service } = require('./base');

const sessionStore = new Service();

// isSessionActive previously ran on every single authenticated request, adding
// a serialized DB round-trip to every route. A revoked session only needs to
// be caught within a bounded delay (not instantly), so cache the "active"
// verdict for a few seconds per (user_id, session_id) to remove that
// round-trip from the hot path. Revocation still takes effect within TTL.
const SESSION_CACHE_TTL_MS = 30000;
const sessionActiveCache = new Map(); // key -> expiresAt (only "active" results are cached)

const getCachedSessionActive = (key) => {
    const expiresAt = sessionActiveCache.get(key);
    if (expiresAt === undefined) return false;
    if (Date.now() >= expiresAt) {
        sessionActiveCache.delete(key);
        return false;
    }
    return true;
};

// For regular users (type=3), tokens carry a session id (sid) tracked server-side
// to enforce the max-device limit. Returns true if the session is still active.
// Tokens without a sid (e.g. legacy tokens issued before sessions) are allowed
// through so existing logins are not invalidated.
const isSessionActive = async (decoded) => {
    if (decoded.type !== managerialAccountTypes.regular) return true;
    if (!decoded.sid) return true;

    const cacheKey = `${decoded.id}:${decoded.sid}`;
    if (getCachedSessionActive(cacheKey)) return true;

    const result = await sessionStore.query(
        `SELECT 1 FROM auth_session WHERE user_id = $1 AND session_id = $2 LIMIT 1`,
        [parseInt(decoded.id), decoded.sid]
    );
    const active = result.success && result.data.length > 0;
    if (active) sessionActiveCache.set(cacheKey, Date.now() + SESSION_CACHE_TTL_MS);
    return active;
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
    if (token == null) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: 'NO_TOKEN'
        });
    }
    try{
        var decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Your session has expired. Please log in again.',
                error: 'TOKEN_EXPIRED'
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid authentication token.',
            error: 'INVALID_TOKEN'
        });
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
 * Shared body of the permission guards. Reads the Bearer token and answers:
 *   no token                       → 401 NO_TOKEN
 *   bad/expired token              → 403 INVALID_TOKEN
 *   token without a permissions [] → 403 NO_PERMISSIONS
 *   `deny(permissions)` returns    → 403 INSUFFICIENT_PERMISSIONS with that { message, ...fields }
 * otherwise attaches the user (req.user, req.body.user_id/user_type) and calls next().
 * Guards don't check the session table; only authenticateUser does.
 *
 * @param {(permissions: string[]) => (object|null)} deny - Denial details, or null to allow
 * @returns {Function} Express middleware
 */
const permissionGuard = (deny) => {
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

            const denial = deny(decoded.permissions);
            if (denial) {
                const { message, ...fields } = denial;
                return res.status(403).json({
                    success: false,
                    message,
                    error: 'INSUFFICIENT_PERMISSIONS',
                    ...fields
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
 * Require a single permission
 * @param {string} permission - Permission string (e.g., 'user.read.all')
 * @returns {Function} Express middleware
 */
const requirePermission = (permission) => permissionGuard((granted) => (
    granted.includes(permission)
        ? null
        : { message: `Permission denied: ${permission} required`, required: permission }
));

/**
 * Require ANY of the specified permissions
 * @param {string[]} permissions - Array of permission strings
 * @returns {Function} Express middleware
 */
const requireAnyPermission = (permissions) => permissionGuard((granted) => (
    permissions.some(p => granted.includes(p))
        ? null
        : { message: `Permission denied: One of [${permissions.join(', ')}] required`, required: permissions }
));

/**
 * Require ALL of the specified permissions
 * @param {string[]} permissions - Array of permission strings
 * @returns {Function} Express middleware
 */
const requireAllPermissions = (permissions) => permissionGuard((granted) => {
    const missingPermissions = permissions.filter(p => !granted.includes(p));
    return missingPermissions.length === 0
        ? null
        : {
            message: `Permission denied: Missing permissions [${missingPermissions.join(', ')}]`,
            required: permissions,
            missing: missingPermissions
        };
});

// `<resource>.<action>.all` is the only grant; the denial lists it as an array.
const requireGlobalPermission = (resource, action) => {
    const globalPermission = `${resource}.${action}.all`;
    return permissionGuard((granted) => (
        granted.includes(globalPermission)
            ? null
            : { message: `Permission denied: ${globalPermission} required`, required: [globalPermission] }
    ));
};

/**
 * Require scope-based access
 * @param {string} resource - Resource name (e.g., 'user', 'course')
 * @param {string} action - Action name (e.g., 'read', 'update')
 * @param {Function} getResourceOwnerId - Unused; kept for call-site compatibility
 * @returns {Function} Express middleware
 */
const requireScopeAccess = (resource, action, _getResourceOwnerId) => requireGlobalPermission(resource, action);

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
const requireCourseAccess = (resource, action, _getCourseId) => requireGlobalPermission(resource, action);

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
