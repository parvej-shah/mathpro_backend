const { test } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const requestMetrics = require('../../middleware/requestMetrics');
const logger = require('../../util/logger');

function captureConsoleError(fn) {
    const lines = [];
    const original = console.error;
    console.error = (line) => lines.push(line);
    return Promise.resolve(fn()).finally(() => { console.error = original; }).then(() => lines);
}

test('logger.error writes one JSON line with the request id of the request it runs in', async () => {
    const app = express();
    app.use(requestMetrics);
    app.get('/x', async (req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 5)); // across an async hop
        const err = Object.assign(new Error('duplicate key'), { code: '23505', detail: 'Key (id)=(1)' });
        logger.error('Error in create:', err);
        res.json({ ok: true });
    });

    const lines = await captureConsoleError(() => request(app).get('/x').set('x-request-id', 'req-123'));
    assert.strictEqual(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.strictEqual(entry.type, 'error');
    assert.strictEqual(entry.msg, 'Error in create:');
    assert.strictEqual(entry.requestId, 'req-123');
    assert.strictEqual(entry.error.code, '23505');
    assert.strictEqual(entry.error.detail, 'Key (id)=(1)');
});

test('outside a request there is no request id, and non-Error values are kept', async () => {
    const lines = await captureConsoleError(() => logger.error('SMS failed:', { status: 'FAILED' }));
    const entry = JSON.parse(lines[0]);
    assert.strictEqual(entry.requestId, undefined);
    assert.deepStrictEqual(entry.error, { value: '{"status":"FAILED"}' });
});
