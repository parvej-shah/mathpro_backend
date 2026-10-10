const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const { pool } = require('../service/base');

after(async () => {
    await pool.end();
});

test('GET /ping responds without touching the DB', async () => {
    const res = await request(app).get('/ping');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { message: 'pong' });
});

test('GET /health reaches the test database', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
});

test('CORS: preflight is answered for any origin with the Authorization header allowed', async () => {
    const res = await request(app)
        .options('/user/course/list')
        .set('Origin', 'https://www.mathpro.academy')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization,content-type');
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers['access-control-allow-origin'], '*');
    assert.match(res.headers['access-control-allow-headers'] || '', /authorization/i);
});

test('CORS: normal responses allow any origin', async () => {
    const res = await request(app).get('/ping').set('Origin', 'https://admin.mathpro.academy');
    assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});

test('JSON bodies up to the 15mb limit are parsed; larger ones are rejected', async () => {
    const ok = await request(app).post('/admin/auth/login').send({ login: 'x'.repeat(1024 * 1024) });
    assert.notStrictEqual(ok.status, 413);
    const tooBig = await request(app).post('/admin/auth/login')
        .set('Content-Type', 'application/json')
        .send(`{"login":"${'x'.repeat(16 * 1024 * 1024)}"}`);
    assert.strictEqual(tooBig.status, 413);
});
