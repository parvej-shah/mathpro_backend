// POST /user/coupon/validate and /apply dispatch on the target type (course, bundle or book)
// to that type's coupon check, and /apply records a click for courses and bundles only.
// Pins the dispatch through the real routes, so the per-type table can't mix them up.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { STUDENT, seed, studentToken, pool } = require('../helpers/fixtures');

const BOOK_ID = 731;
let couponId;

before(async () => {
    await seed();
    const now = Math.floor(Date.now() / 1000);
    await pool.query(`INSERT INTO book (id, title, price, is_active) VALUES ($1, 'R4 Book', 500, true) ON CONFLICT (id) DO NOTHING`, [BOOK_ID]);
    const res = await pool.query(
        `INSERT INTO coupons (name, code, discount_type, discount_value, start_time, end_time,
                              created_at, updated_at, status, usage_limit, usage_count)
         VALUES ('Targets', 'R4TARGETS', 'fixed', 100, $1, $2, $1, $1, 'active', NULL, 0) RETURNING id`,
        [now - 60, now + 3600]
    );
    couponId = res.rows[0].id;
    await pool.query('INSERT INTO coupon_courses (coupon_id, course_id, created_at) VALUES ($1, 1, $2)', [couponId, now]);
    await pool.query('INSERT INTO coupon_bundles (coupon_id, bundle_id, created_at) VALUES ($1, 1, $2)', [couponId, now]);
    await pool.query('INSERT INTO coupon_books (coupon_id, book_id, created_at) VALUES ($1, $2, $3)', [couponId, BOOK_ID, now]);
});

after(() => pool.end());

const post = (path, body) => request(app).post(path).set('Authorization', `Bearer ${studentToken()}`).send({ coupon_code: 'R4TARGETS', ...body });
const clicks = async () => (await pool.query(
    'SELECT course_id, bundle_id, book_id FROM coupon_clicks WHERE coupon_id = $1 AND user_id = $2 ORDER BY id', [couponId, STUDENT.id])).rows;

// Course 1000 -> 900, bundle 900 -> 800, book 500 -> 400 (fixed 100 off each).
const targets = [
    ['course_id', 1, 1000, 900, { course_id: 1, bundle_id: null, book_id: null }],
    ['bundle_id', 1, 900, 800, { course_id: null, bundle_id: 1, book_id: null }],
    ['book_id', BOOK_ID, 500, 400, null],
];

for (const [field, id, original, final, click] of targets) {
    test(`${field}: validate and apply use that item's price; click recorded: ${click ? 'yes' : 'no'}`, async () => {
        const before = (await clicks()).length;

        const valid = await post('/user/coupon/validate', { [field]: id });
        assert.strictEqual(valid.status, 200, JSON.stringify(valid.body));
        assert.strictEqual(valid.body.valid, true);

        const applied = await post('/user/coupon/apply', { [field]: id });
        assert.strictEqual(applied.status, 200, JSON.stringify(applied.body));
        assert.strictEqual(applied.body.success, true);
        assert.deepStrictEqual([applied.body.data.original_price, applied.body.data.final_price], [original, final]);

        const after = await clicks();
        if (click) {
            assert.strictEqual(after.length, before + 1);
            assert.deepStrictEqual(after[after.length - 1], click);
        } else {
            assert.strictEqual(after.length, before);
        }
    });
}

test('a coupon not linked to the requested item is refused for that type', async () => {
    const res = await post('/user/coupon/validate', { bundle_id: 999999 });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.valid, false);
});
