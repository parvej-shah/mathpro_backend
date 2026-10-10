/**
 * Errors that are safe to show to the client. Throw one from a controller or service and
 * the central error middleware (middleware/errorHandler.js) turns it into the standard
 * envelope `{ success: false, error: message, ...extra }` with `status`.
 *
 * Anything that is not an AppError is treated as a bug: logged in full, answered with a
 * generic 500, never serialized.
 */
class AppError extends Error {
    /**
     * @param {string} message  Client-facing message (becomes `error` in the response).
     * @param {object} [opts]
     * @param {number} [opts.status=400]
     * @param {object} [opts.body]  Extra top-level response fields, e.g. `{ code, details }`.
     */
    constructor(message, { status = 400, body } = {}) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.body = body;
    }
}

const withStatus = (status) => class extends AppError {
    constructor(message, opts = {}) {
        super(message, { ...opts, status });
    }
};

class ValidationError extends withStatus(400) {}
class UnauthorizedError extends withStatus(401) {}
class ForbiddenError extends withStatus(403) {}
class NotFoundError extends withStatus(404) {}
class ConflictError extends withStatus(409) {}
class GoneError extends withStatus(410) {}

module.exports = {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    GoneError,
};
