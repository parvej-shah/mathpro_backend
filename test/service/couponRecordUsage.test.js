const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { ADMIN, STUDENT, COURSE_ID, seed, pool } = require('../helpers/fixtures');
const CouponService = require('../../service/managerial/coupon');

// recordUsage() runs inside the payment flow. These pin its transaction behaviour:
// a new usage commits, a repeat of the same transaction is an idempotent no-op,
// and a rejected one rolls back without touching the counters.
const coupons = new CouponService();
const price = { originalPrice: 1000, discountAmount: 100, finalPrice: 900 };
let couponId;

const state = async () => {
    const usage = await pool.query('SELECT count(*)::int AS n FROM coupon_usage WHERE coupon_id = $1', [couponId]);
    const coupon = await pool.query('SELECT usage_count FROM coupons WHERE id = $1', [couponId]);
    return { rows: usage.rows[0].n, usageCount: coupon.rows[0].usage_count };
};

before(async () => {
    await seed();
    const now = Math.floor(Date.now() / 1000);
    const res = await pool.query(
        `INSERT INTO coupons (name, code, discount_type, discount_value, start_time, end_time,
                              created_at, updated_at, status, usage_limit, usage_count)
         VALUES ('Test', 'TXTEST', 'fixed', 100, $1, $2, $1, $1, 'active', 1, 0) RETURNING id`,
        [now - 60, now + 3600]
    );
    couponId = res.rows[0].id;
    await pool.query('INSERT INTO coupon_courses (coupon_id, course_id, created_at) VALUES ($1, $2, $3)', [couponId, COURSE_ID, Math.floor(Date.now() / 1000)]);
});

after(async () => {
    await pool.end();
});

test('a new usage commits the row and the counter', async () => {
    const result = await coupons.recordUsage(couponId, STUDENT.id, COURSE_ID, null, price, 'pending', 'TX-1');
    assert.strictEqual(result.success, true, result.error);
    assert.deepStrictEqual(await state(), { rows: 1, usageCount: 1 });
});

test('repeating the same transaction is idempotent', async () => {
    const result = await coupons.recordUsage(couponId, STUDENT.id, COURSE_ID, null, price, 'pending', 'TX-1');
    assert.strictEqual(result.success, true, result.error);
    assert.deepStrictEqual(await state(), { rows: 1, usageCount: 1 });
});

test('a usage over the limit is rejected and rolls back', async () => {
    const result = await coupons.recordUsage(couponId, ADMIN.id, COURSE_ID, null, price, 'failed', 'TX-2');
    assert.strictEqual(result.success, false);
    assert.deepStrictEqual(await state(), { rows: 1, usageCount: 1 });
    assert.strictEqual(pool.totalCount - pool.idleCount, 0, 'no connection left checked out');
});
