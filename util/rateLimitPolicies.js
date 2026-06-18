const { rateLimiter, getClientIp } = require('./rateLimiter');

const makeIpKey = () => (req) => `ip:${getClientIp(req)}`;

const makeUserKey = () => (req) => {
    const userId = req.user?.id ?? req.body?.user_id;
    if (userId !== undefined && userId !== null && `${userId}`.trim() !== '') {
        return `user:${userId}|ip:${getClientIp(req)}`;
    }

    return `ip:${getClientIp(req)}`;
};

const makeIdentifierKey = () => (req) => {
    const body = req.body || {};
    const identifier =
        body.login ||
        body.email ||
        body.phone ||
        body.contact ||
        body.identifier;

    if (identifier !== undefined && identifier !== null && `${identifier}`.trim() !== '') {
        return `id:${`${identifier}`.trim().toLowerCase()}|ip:${getClientIp(req)}`;
    }

    return `ip:${getClientIp(req)}`;
};

const ipLimiter = (scope, tokensPerInterval, interval, options = {}) =>
    rateLimiter(tokensPerInterval, interval, {
        ...options,
        scope,
        keyGenerator: makeIpKey(),
    });

const actorLimiter = (scope, tokensPerInterval, interval, options = {}) =>
    rateLimiter(tokensPerInterval, interval, {
        ...options,
        scope,
        keyGenerator: makeUserKey(),
    });

const identifierLimiter = (scope, tokensPerInterval, interval, options = {}) =>
    rateLimiter(tokensPerInterval, interval, {
        ...options,
        scope,
        keyGenerator: makeIdentifierKey(),
    });

module.exports = {
    ipLimiter,
    actorLimiter,
    identifierLimiter,
};
