/**
 * Error shape for the /v2 APIs: `{ success: false, error, code, timestamp, details? }`.
 *
 * Each factory returns an AppError carrying that body. Controllers `throw` it and the
 * central middleware (middleware/errorHandler.js) sends it with its status.
 */
const { AppError } = require('../errors/AppError');

class ErrorHandler {
    /**
     * @param {string} error - Human-readable error message
     * @param {string} code - Error code (e.g., 'MODULE_NOT_FOUND')
     * @param {object} details - Field-level validation errors
     * @param {number} statusCode - HTTP status code
     * @returns {AppError}
     */
    static createErrorResponse(error, code, details = null, statusCode = 400) {
        // `error` is repeated in the body so the key order (and an absent message) stays
        // exactly what the clients have always received.
        const body = { error, code, timestamp: new Date().toISOString() };
        if (details) {
            body.details = details;
        }
        return new AppError(String(error ?? ''), { status: statusCode, body });
    }

    /** 422 with field-level details: `{ field: message }`. */
    static validationError(validationErrors) {
        return this.createErrorResponse('Validation failed', 'VALIDATION_ERROR', validationErrors, 422);
    }

    /** 404 `<Resource> not found` with code `<RESOURCE>_NOT_FOUND`. */
    static notFound(resource) {
        return this.createErrorResponse(
            `${resource} not found`,
            `${resource.toUpperCase().replace(/\s/g, '_')}_NOT_FOUND`,
            null,
            404
        );
    }

    static unauthorized() {
        return this.createErrorResponse('Authentication required', 'UNAUTHORIZED', null, 401);
    }

    static forbidden() {
        return this.createErrorResponse('Insufficient permissions', 'FORBIDDEN', null, 403);
    }

    static serverError(message = 'Internal server error') {
        return this.createErrorResponse(message, 'INTERNAL_SERVER_ERROR', null, 500);
    }

    /**
     * Error middleware for the /v2 mounts: gives unexpected errors the V2 500 shape
     * (keeping the original as `cause` for the log), then hands everything on to the
     * central handler.
     */
    static v2Shape(err, req, res, next) {
        if (err instanceof AppError || (err && err.expose && err.status < 500)) {
            return next(err);
        }
        const serverError = ErrorHandler.serverError();
        serverError.cause = err;
        return next(serverError);
    }
}

module.exports = ErrorHandler;
