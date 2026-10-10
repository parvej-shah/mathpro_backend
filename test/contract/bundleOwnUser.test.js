// GET /user/bundle/*/:user_id: a student may only use their own id in the URL (Frontend always
// sends the id from its token). Another user's id → 403, and nothing about them is returned.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { STUDENT, seed, studentToken, pool } = require('../helpers/fixtures');

const OTHER = 902;

before(async () => {
    await seed();
    await pool.query(`INSERT INTO managerial_auth (id, name, type, login, password, profile)
                      VALUES (${OTHER}, 'Other Student', 3, '01990000902', 'x', '{}') ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO bundle_purchase (user_id, bundle_id, amount, transaction_id, timestamp)
                      VALUES (${OTHER}, 1, 900, 'OTHER-TX', 1) ON CONFLICT DO NOTHING`);
});

after(async () => {
    // Later files (the route snapshot) delete bundle 1, which this purchase would block.
    await pool.query(`DELETE FROM bundle_purchase WHERE transaction_id = 'OTHER-TX'`);
    await pool.end();
});

const paths = (userId) => [
    `/user/bundle/my-bundles/${userId}`,
    `/user/bundle/bundle-courses/${userId}`,
    `/user/bundle/all-courses/${userId}`,
    `/user/bundle/1/check-purchase/${userId}`,
    `/user/bundle/1/check-prebook/${userId}`,
    `/user/bundle/1/check-duplicates/${userId}`,
];
const get = (path) => request(app).get(path).set('Authorization', `Bearer ${studentToken()}`);

test("another user's id → 403", async () => {
    for (const path of [...paths(OTHER), ...paths('abc')]) {
        const res = await get(path);
        assert.strictEqual(res.status, 403, path);
        assert.deepStrictEqual(res.body, { success: false, error: 'Unauthorized' }, path);
    }
});

test('own id → answered as before', async () => {
    for (const path of paths(STUDENT.id)) {
        const res = await get(path);
        assert.strictEqual(res.status, 200, path);
        assert.strictEqual(res.body.success, true, path);
    }
});

test('still requires a login', async () => {
    const res = await request(app).get(`/user/bundle/my-bundles/${STUDENT.id}`);
    assert.strictEqual(res.status, 401);
});
