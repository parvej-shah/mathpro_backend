const { safeMessage } = require('../errors/dbErrors');
const logger = require('../util/logger');

class Controller{
    constructor() {
    }
}

// The standard reply for a service result: 200 with it on success, 400 with it on failure.
// An Error object in `error` (raw pg or JS error) is logged and replaced by a safe message.
function respond(res, result) {
    if (!result.success && result.error instanceof Error) {
        logger.error('result_error', result.error);
        result = { ...result, error: safeMessage(result.error) };
    }
    return res.status(result.success ? 200 : 400).json(result);
}

// Wraps a handler so an unexpected error is logged and answered 500 with `body`: the reply
// that endpoint has always sent, which clients show as-is. `body` may be a function of the
// error. Replaces the try/catch that every such method used to carry.
function catchAs(body, handler) {
    return async (req, res, next) => {
        try {
            return await handler(req, res, next);
        } catch (error) {
            if (res.headersSent) throw error;
            logger.error('http_error', error, { method: req.method, path: req.originalUrl });
            return res.status(500).json(typeof body === 'function' ? body(error) : body);
        }
    };
}

// A handler that calls the service and replies with respond(): handle((req) => service.x(req.params.id)).
// Rejections reach the router's error handler, as with any async handler here.
function handle(call) {
    return async (req, res) => respond(res, await call(req));
}

exports.Controller = Controller;
exports.respond = respond;
exports.catchAs = catchAs;
exports.handle = handle;
