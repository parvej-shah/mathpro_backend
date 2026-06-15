const { RateLimiter } = require('limiter');

// Store rate limiters per IP
const limiters = new Map();

/**
 * Rate limiter middleware factory
 * @param {number} tokensPerInterval - Number of requests allowed
 * @param {number} interval - Time window in milliseconds
 * @returns {Function} Express middleware
 */
function rateLimiter(tokensPerInterval, interval) {
    return (req, res, next) => {
        const clientId = req.ip || req.connection.remoteAddress;
        const key = `${req.route.path}-${clientId}`;

        if (!limiters.has(key)) {
            limiters.set(key, new RateLimiter(tokensPerInterval, interval));
        }

        const limiter = limiters.get(key);

        if (limiter.tryRemoveTokens(1)) {
            next();
        } else {
            res.status(429).json({
                success: false,
                message: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(interval / 1000)
            });
        }
    };
}

// Cleanup old limiters periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, limiter] of limiters.entries()) {
        // Remove limiters that haven't been used in the last hour
        if (now - limiter.lastRefill > 3600000) {
            limiters.delete(key);
        }
    }
}, 300000); // Cleanup every 5 minutes

module.exports = { rateLimiter };