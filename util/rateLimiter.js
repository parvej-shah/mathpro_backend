const { RateLimiter } = require('limiter');

// Store rate limiters by scope + actor so different routes can share policies
// without stepping on each other.
const limiters = new Map();

const getClientIp = (req) => {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }

    return (
        req.ip ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown'
    );
};

const getDefaultActorKey = (req) => {
    const body = req.body || {};
    const userId = req.user?.id ?? body.user_id;

    if (userId !== undefined && userId !== null && `${userId}`.trim() !== '') {
        return `user:${userId}`;
    }

    const identifier =
        body.login ||
        body.email ||
        body.phone ||
        body.contact ||
        body.coupon_code ||
        body.code ||
        body.couponId ||
        body.course_id ||
        body.bundle_id;

    if (identifier !== undefined && identifier !== null && `${identifier}`.trim() !== '') {
        return `id:${`${identifier}`.trim().toLowerCase()}`;
    }

    return 'anonymous';
};

const getDefaultScope = (req, scope) => {
    if (scope) return scope;
    if (req.route?.path && req.baseUrl) {
        return `${req.baseUrl}${req.route.path}`;
    }
    if (req.route?.path) {
        return req.route.path;
    }
    if (req.baseUrl) {
        return req.baseUrl;
    }
    return req.originalUrl?.split('?')[0] || 'unknown';
};

/**
 * Rate limiter middleware factory
 * @param {number} tokensPerInterval - Number of requests allowed
 * @param {number} interval - Time window in milliseconds
 * @param {Object} options
 * @param {string} [options.scope] - Logical scope for the limiter key
 * @param {(req) => string} [options.keyGenerator] - Custom actor key generator
 * @param {boolean} [options.includeMethod] - Include HTTP method in the limiter key
 * @param {string} [options.message] - Response message for 429s
 * @param {boolean} [options.logBlocked] - Log blocked requests to stderr
 * @returns {Function} Express middleware
 */
function rateLimiter(tokensPerInterval, interval, options = {}) {
    const {
        scope,
        keyGenerator,
        includeMethod = false,
        message = 'Too many requests. Please try again later.',
        retryAfter = Math.max(1, Math.ceil(interval / 1000)),
        logBlocked = false,
    } = options;

    return (req, res, next) => {
        const clientId = getClientIp(req);
        const actorKey = keyGenerator ? keyGenerator(req) : getDefaultActorKey(req);
        const scopeKey = getDefaultScope(req, scope);
        const methodKey = includeMethod ? req.method : '';
        const key = [scopeKey, methodKey, actorKey, clientId].filter(Boolean).join('::');

        let entry = limiters.get(key);
        if (!entry) {
            entry = {
                limiter: new RateLimiter(tokensPerInterval, interval),
                lastSeen: Date.now(),
            };
            limiters.set(key, entry);
        } else {
            entry.lastSeen = Date.now();
        }

        if (entry.limiter.tryRemoveTokens(1)) {
            return next();
        }

        if (logBlocked) {
            console.warn('Rate limit exceeded', {
                scope: scopeKey,
                actorKey,
                clientId,
                method: req.method,
                path: req.originalUrl,
            });
        }

        res.set('Retry-After', `${retryAfter}`);
        return res.status(429).json({
            success: false,
            message,
            retryAfter,
        });
    };
}

// Cleanup old limiters periodically without keeping the process alive.
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of limiters.entries()) {
        if (now - entry.lastSeen > 3600000) {
            limiters.delete(key);
        }
    }
}, 300000);

if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
}

module.exports = { rateLimiter, getClientIp, getDefaultActorKey };
