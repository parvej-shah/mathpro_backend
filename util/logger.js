/**
 * One-line JSON logs, same style as util/observability.js, so errors are searchable by
 * `msg` and `requestId` in the Coolify log stream:
 *
 *   {"type":"error","msg":"Error in createCourse:","requestId":"a1b2c3","error":{...}}
 *
 * The request id comes from the request context (middleware/requestMetrics.js), so code
 * deep in a service gets it without passing `req` around.
 */
const { AsyncLocalStorage } = require("async_hooks");

const requestContext = new AsyncLocalStorage();

function serializeError(err) {
    if (!(err instanceof Error)) return { value: typeof err === "string" ? err : safeStringify(err) };
    const out = { name: err.name, message: err.message, stack: err.stack };
    // pg errors carry the useful context in these fields
    for (const key of ["code", "detail", "constraint", "table", "column", "where"]) {
        if (err[key] !== undefined) out[key] = err[key];
    }
    if (err.cause) out.cause = serializeError(err.cause);
    return out;
}

function safeStringify(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * @param {string} msg  What failed, e.g. 'Error in createCourse:'.
 * @param {*} [err]     The caught error (or any value worth logging with it).
 * @param {object} [context]  Extra fields.
 */
function error(msg, err, context = {}) {
    const store = requestContext.getStore();
    const line = { type: "error", msg, ...(store && { requestId: store.requestId }), ...context };
    if (err !== undefined) line.error = serializeError(err);
    console.error(JSON.stringify(line));
}

module.exports = { error, serializeError, requestContext };
