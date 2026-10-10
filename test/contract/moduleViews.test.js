// Student module-view endpoints: a user not enrolled in the course gets 403, bad input 400.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, sign, pool } = require('../helpers/fixtures');

const OUTSIDER = { id: 821, name: 'Not Enrolled', type: 3, login: '01788000821' };

before(async () => {
    await seed();
    await pool.query(
        `INSERT INTO managerial_auth (id, name, type, login, password, phone, profile)
         VALUES ($1, $2, 3, $3, 'x', $3, '{}')`, [OUTSIDER.id, OUTSIDER.name, OUTSIDER.login]
    );
});

after(async () => {
    await pool.end();
});

const auth = () => `Bearer ${sign(OUTSIDER, [], [])}`;
const NOT_ENROLLED = { success: false, error: 'You are not enrolled in this course' };

test('recordView: not enrolled → 403; non-numeric ids → 400', async () => {
    const res = await request(app).post('/user/module/recordView').set('Authorization', auth())
        .send({ courseId: 1, moduleId: 1, chapterId: 1 });
    assert.strictEqual(res.status, 403);
    assert.deepStrictEqual(res.body, NOT_ENROLLED);

    const bad = await request(app).post('/user/module/recordView').set('Authorization', auth())
        .send({ courseId: 'x', moduleId: 1, chapterId: 1 });
    assert.strictEqual(bad.status, 400);
});

test('mostRecent: not enrolled → 403; bad course id → 400', async () => {
    const res = await request(app).get('/user/module/mostRecent/1').set('Authorization', auth());
    assert.strictEqual(res.status, 403);
    assert.deepStrictEqual(res.body, NOT_ENROLLED);

    const bad = await request(app).get('/user/module/mostRecent/abc').set('Authorization', auth());
    assert.strictEqual(bad.status, 400);
    assert.deepStrictEqual(bad.body, { success: false, error: 'Valid courseId is required' });
});
