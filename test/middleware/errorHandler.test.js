const { test } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const errorHandler = require('../../middleware/errorHandler');
const {
    ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, GoneError, AppError,
} = require('../../errors/AppError');

// The statuses both clients branch on (Frontend 401/403/404/429/500,
// Admin 400/401/403/404/409/422/500) must come out of the middleware unchanged.
function appThrowing(err) {
    const app = express();
    app.use(express.json());
    app.post('/boom', () => { throw err; });
    app.use(errorHandler);
    return app;
}

const cases = [
    [new ValidationError('bad input'), 400],
    [new UnauthorizedError('login first'), 401],
    [new ForbiddenError('not allowed'), 403],
    [new NotFoundError('missing'), 404],
    [new ConflictError('exists'), 409],
    [new GoneError('gone'), 410],
    [new AppError('validation failed', { status: 422 }), 422],
    [new AppError('slow down', { status: 429 }), 429],
];

for (const [err, status] of cases) {
    test(`${err.name} -> ${status} with the standard envelope`, async () => {
        const res = await request(appThrowing(err)).post('/boom');
        assert.strictEqual(res.status, status);
        assert.deepStrictEqual(res.body, { success: false, error: err.message });
    });
}

test('AppError body fields are merged into the envelope (V2 code/details shape)', async () => {
    const err = new AppError('Validation failed', { status: 422, body: { code: 'VALIDATION_ERROR', details: { a: 'x' } } });
    const res = await request(appThrowing(err)).post('/boom');
    assert.strictEqual(res.status, 422);
    assert.deepStrictEqual(res.body, { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: { a: 'x' } });
});

test('unknown errors become a generic 500 and never leak their message or fields', async () => {
    const pgLike = Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
        code: '23505', detail: 'Key (email)=(a@b.c) already exists.',
    });
    const res = await request(appThrowing(pgLike)).post('/boom');
    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(res.body, { success: false, error: 'Internal Server Error' });
});

test('malformed JSON bodies keep their 400 from Express', async () => {
    const res = await request(appThrowing(new Error('unreached')))
        .post('/boom').set('content-type', 'application/json').send('{"a":');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(typeof res.body.error, 'string');
});

test('under /v2, unexpected errors keep the V2 500 shape (code + timestamp)', async () => {
    const ErrorHandler = require('../../util/errorHandler');
    // Same as the real V2 routers: express-promise-router forwards rejected handlers.
    const router = require('express-promise-router')();
    router.get('/boom', async () => { throw new TypeError('cannot read x of undefined'); });
    router.get('/missing', async () => { throw ErrorHandler.notFound('Module'); });
    const app = express();
    app.use('/v2/x', router);
    app.use('/v2', ErrorHandler.v2Shape);
    app.use(errorHandler);

    const boom = await request(app).get('/v2/x/boom');
    assert.strictEqual(boom.status, 500);
    assert.deepStrictEqual(Object.keys(boom.body), ['success', 'error', 'code', 'timestamp']);
    assert.strictEqual(boom.body.error, 'Internal server error');
    assert.strictEqual(boom.body.code, 'INTERNAL_SERVER_ERROR');

    const missing = await request(app).get('/v2/x/missing');
    assert.strictEqual(missing.status, 404);
    assert.deepStrictEqual(Object.keys(missing.body), ['success', 'error', 'code', 'timestamp']);
    assert.strictEqual(missing.body.code, 'MODULE_NOT_FOUND');
});
