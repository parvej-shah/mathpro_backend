// Student bundle endpoints keyed by user.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { STUDENT, seed, studentToken, pool } = require('../helpers/fixtures');

before(async () => {
    await seed();
    await pool.query(
        `INSERT INTO bundle_purchase (user_id, bundle_id, amount, transaction_id, timestamp)
         VALUES ($1, 1, 900, 'UB-TX', 1) ON CONFLICT DO NOTHING`, [STUDENT.id]
    );
    await pool.query(
        `INSERT INTO takes (user_id, course_id, amount, transaction_id, timestamp)
         VALUES ($1, 1, 0, 'UB-TX', 1) ON CONFLICT DO NOTHING`, [STUDENT.id]
    );
});

after(async () => {
    await pool.end();
});

const get = (path) => request(app).get(path).set('Authorization', `Bearer ${studentToken()}`);

for (const name of ['my-bundles', 'bundle-courses', 'all-courses']) {
    test(`${name}: answers from the user's purchases`, async () => {
        const byUrl = await get(`/user/bundle/${name}/${STUDENT.id}`);
        assert.strictEqual(byUrl.status, 200);
        assert.strictEqual(byUrl.body.success, true);
        assert.ok(Array.isArray(byUrl.body.data) && byUrl.body.data.length > 0, JSON.stringify(byUrl.body));

        // CURRENT BEHAVIOUR: the legacy no-id route is registered after GET /:id, which
        // catches it first, so it never reaches its handler.
        const legacy = await get(`/user/bundle/${name}`);
        assert.strictEqual(legacy.status, 400);
        assert.deepStrictEqual(legacy.body, { success: false, error: 'Bundle ID must be numeric' });
    });
}

test('check-purchase / check-prebook / check-duplicates', async () => {
    assert.deepStrictEqual((await get(`/user/bundle/1/check-purchase/${STUDENT.id}`)).body, { success: true, data: { purchased: true } });
    assert.deepStrictEqual((await get('/user/bundle/1/check-purchase/999')).body, { success: true, data: { purchased: false } });
    assert.deepStrictEqual((await get(`/user/bundle/1/check-prebook/${STUDENT.id}`)).body, { success: true, data: { prebooked: false } });
    const dup = await get(`/user/bundle/1/check-duplicates/${STUDENT.id}`);
    assert.strictEqual(dup.status, 200);
    assert.strictEqual(dup.body.success, true);
});
