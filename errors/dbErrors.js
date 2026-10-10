const { AppError } = require('./AppError');

// Postgres SQLSTATE codes that are caused by the request's data rather than by a bug.
// Each maps to an HTTP status and a message that is safe to show: no SQL, constraint
// or table names, no row values.
const KNOWN = {
    '23505': { status: 409, message: 'A record with the same value already exists.' },
    '23503': { status: 409, message: 'This record is linked to other data and cannot be changed or deleted.' },
    '23502': { status: 400, message: 'A required field is missing.' },
    '23514': { status: 400, message: 'A value is outside the allowed range.' },
    '22P02': { status: 400, message: 'Invalid input format.' },
    '22001': { status: 400, message: 'A value is too long.' },
    '22003': { status: 400, message: 'A number is out of range.' },
    '22007': { status: 400, message: 'Invalid date or time value.' },
    '22008': { status: 400, message: 'Invalid date or time value.' },
};

const GENERIC = { status: 500, message: 'Database error.' };

/** `{ status, message }` safe to send for a pg error (or anything else thrown by a query). */
function describeDbError(err) {
    return KNOWN[err && err.code] || GENERIC;
}

/** Message safe to return to the client for anything caught: AppErrors keep theirs. */
function safeMessage(err) {
    return err instanceof AppError ? err.message : describeDbError(err).message;
}

/** The same, as an AppError, for code that throws. */
function toAppError(err) {
    const { status, message } = describeDbError(err);
    const appError = new AppError(message, { status });
    appError.cause = err;
    return appError;
}

module.exports = { describeDbError, safeMessage, toAppError };
