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

exports.Controller = Controller;
exports.respond = respond;
