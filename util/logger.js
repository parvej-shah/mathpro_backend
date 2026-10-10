/**
 * One-line JSON logs, same style as util/observability.js, so errors are searchable by
 * `type` and `requestId` in the Coolify log stream.
 */

function serializeError(err) {
    if (!(err instanceof Error)) return { value: String(err) };
    const out = { name: err.name, message: err.message, stack: err.stack };
    // pg errors carry the useful context in these fields
    for (const key of ['code', 'detail', 'constraint', 'table', 'column', 'where']) {
        if (err[key] !== undefined) out[key] = err[key];
    }
    if (err.cause) out.cause = serializeError(err.cause);
    return out;
}

function error(type, err, context = {}) {
    console.error(JSON.stringify({ type, ...context, error: serializeError(err) }));
}

module.exports = { error, serializeError };
