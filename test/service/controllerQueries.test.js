// The SQL that used to live in controllers (REFACTOR_PLAN.md task 3.2), now service methods.
// Runs each one against real rows so a broken move shows up here, not only as a status change.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { COURSE_ID, seed, pool } = require('../helpers/fixtures');
const { CourseService } = require('../../service/managerial/course');
const { BundleService } = require('../../service/managerial/bundle');
const CouponService = require('../../service/managerial/coupon');
const StreakService = require('../../service/streakService');

const courses = new CourseService();
const bundles = new BundleService();
const coupons = new CouponService();
const streaks = new StreakService();
const USER = 801;
let prebookingId;
let bundlePrebookingId;

before(async () => {
    await seed();
    const t = Math.floor(Date.now() / 1000);
    await pool.query(
        `INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile)
         VALUES (${USER}, 'Query User', 3, '01788000801', 'x', 'q801@test.local', '01788000801', '{}')`
    );
    await pool.query(
        `INSERT INTO takes (user_id, course_id, amount, transaction_id, timestamp) VALUES ($1, $2, 900, 'TQ-801', $3)`,
        [USER, COURSE_ID, t]
    );
    await pool.query(
        `INSERT INTO coupons (id, name, code, discount_type, discount_value, start_time, end_time, created_at, updated_at, status)
         VALUES (801, 'Q', 'QCOUPON801', 'fixed', 100, $1, $2, $1, $1, 'active'),
                (802, 'Q2', 'QCOUPON802', 'fixed', 100, $1, $2, $1, $1, 'expired')`,
        [t - 60, t + 3600]
    );
    await pool.query(
        `INSERT INTO coupon_usage (coupon_id, user_id, course_id, original_price, discount_amount, final_price, used_at, payment_status, transaction_id)
         VALUES (801, $1, $2, 1000, 100, 900, $3, 'completed', 'TQ-801')`,
        [USER, COURSE_ID, t]
    );
    prebookingId = (await pool.query(
        `INSERT INTO prebooking (user_id, course_id, email, phone, name, timestamp, utm)
         VALUES ($1, $2, 'p@test.local', '0190', 'Pre Booker', $3, 'old') RETURNING id`, [USER, COURSE_ID, t]
    )).rows[0].id;
    bundlePrebookingId = (await pool.query(
        `INSERT INTO prebooking_bundle (user_id, bundle_id, email, phone, name, timestamp, utm)
         VALUES ($1, 1, 'p@test.local', '0190', 'Pre Booker', $2, 'old') RETURNING id`, [USER, t]
    )).rows[0].id;
    await pool.query(
        `INSERT INTO user_course_streaks (user_id, course_id, current_streak, longest_streak, last_activity_date)
         VALUES ($1, $2, 3, 3, CURRENT_DATE)`, [USER, COURSE_ID]
    );
});

after(async () => {
    await pool.end();
});

test('course purchases: paid list and coupon-joined list', async () => {
    const paid = await courses.listPaidPurchases(COURSE_ID);
    assert.strictEqual(paid.success, true);
    assert.deepStrictEqual(
        paid.data.filter((r) => r.transaction_id === 'TQ-801').map(({ name, amount }) => ({ name, amount })),
        [{ name: 'Query User', amount: 900 }]
    );

    const withCoupons = await courses.listPurchasesWithCoupons(COURSE_ID);
    const row = withCoupons.data.find((r) => r.user_id === USER);
    assert.deepStrictEqual(
        { coupon_used: row.coupon_used, coupon_code: row.coupon_code, amount_saved: row.amount_saved },
        { coupon_used: true, coupon_code: 'QCOUPON801', amount_saved: '100.00' }
    );
    // Enrolments without a completed coupon usage (other test files add some) carry no coupon.
    for (const other of withCoupons.data.filter((r) => r.user_id !== USER)) {
        assert.deepStrictEqual([other.coupon_used, other.coupon_code], [false, null]);
    }
});

test('course prebookings: list, set and clear the UTM tag', async () => {
    const list = await courses.listPrebookings(COURSE_ID);
    assert.deepStrictEqual(Object.keys(list.data[0]).sort(), ['email', 'name', 'phone', 'timestamp', 'utm']);

    const set = await courses.setPrebookingUtm(prebookingId, 'campaignA');
    assert.strictEqual(set.data[0].utm, 'campaignA');
    const cleared = await courses.setPrebookingUtm(prebookingId, null);
    assert.strictEqual(cleared.data[0].utm, null);
    assert.deepStrictEqual((await courses.setPrebookingUtm(999999, 'x')).data, []);
});

test('bundle prebookings: set and clear the UTM tag', async () => {
    assert.strictEqual((await bundles.setPrebookingUtm(bundlePrebookingId, 'b1')).data[0].utm, 'b1');
    assert.strictEqual((await bundles.setPrebookingUtm(bundlePrebookingId, null)).data[0].utm, null);
});

test('coupons: counts per status and usage lookup by transaction', async () => {
    const counts = (await coupons.countCouponsByStatus()).data[0];
    assert.ok(Number(counts.total_coupons) >= 2);
    assert.ok(Number(counts.active_coupons) >= 1);
    assert.ok(Number(counts.expired_coupons) >= 1);

    assert.deepStrictEqual((await coupons.getUsageCouponIds('TQ-801')).data, [{ coupon_id: 801 }]);
    assert.deepStrictEqual((await coupons.getUsageCouponIds('NONE')).data, []);
});

test('streak trends: per-day rows, optionally for one course', async () => {
    const all = await streaks.getStreakTrends(undefined, 30);
    assert.strictEqual(all.success, true);
    assert.deepStrictEqual(Object.keys(all.data[0]).sort(), ['active_streaks', 'avg_streak', 'date', 'total_updates']);
    const one = await streaks.getStreakTrends(String(COURSE_ID), '7');
    assert.ok(Number(one.data[0].active_streaks) >= 1);
    assert.strictEqual((await streaks.getStreakTrends(undefined, 'abc')).success, false);
});
