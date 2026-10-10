// GET /user/payment/history (Frontend billing page): every purchase of the logged-in student,
// with coupon details folded into a `coupon` object in all_transactions.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, sign, pool } = require('../helpers/fixtures');

const USER = { id: 861, name: 'History User', type: 3, login: '01760000861' };

before(async () => {
    await seed();
    await pool.query(`
        INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile)
            VALUES (861, 'History User', 3, '01760000861', 'x', 'h861@test.local', '01760000861', '{"a":1}');
        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free, short_description) VALUES
            (861, 'History Course', 1000, 1000, true, true, 861, 'hist-861', 'hist-861', '[]', false, 'short'),
            (862, 'Bundled History Course', 800, 800, true, true, 862, 'hist-862', 'hist-862', '[]', false, null);
        INSERT INTO bundle (id, title, price, url, is_live, is_active) VALUES (861, 'History Bundle', 1500, 'hist-bundle', true, true);
        INSERT INTO bundle_course (bundle_id, course_id) VALUES (861, 862);
        INSERT INTO book (id, title, price, image_url, is_active, created_at, updated_at) VALUES
            (861, 'History Book', 300, 'img.png', true, 1, 1);
        INSERT INTO coupons (id, name, code, discount_type, discount_value, start_time, end_time, created_at, updated_at, status)
            VALUES (861, 'Hist', 'HIST100', 'fixed', 100, 1, 2000000000, 1, 1, 'active');
        INSERT INTO takes (user_id, course_id, amount, transaction_id, timestamp, coupon_id) VALUES
            (861, 861, 900, 'H-T1', 100, 861),
            (861, 862, 0, 'H-T2', 200, NULL);
        INSERT INTO coupon_usage (coupon_id, user_id, course_id, original_price, discount_amount, final_price, used_at, payment_status, transaction_id)
            VALUES (861, 861, 861, 1000, 100, 900, 100, 'completed', 'H-T1');
        INSERT INTO bundle_purchase (user_id, bundle_id, amount, transaction_id, timestamp) VALUES (861, 861, 1500, 'H-T2', 200);
        INSERT INTO course_book_purchase (user_id, course_id, bundle_id, book_id, amount_paid, transaction_id, ship_name,
            ship_phone, ship_address, ship_city, ship_postcode, fulfillment_status, timestamp) VALUES
            (861, NULL, NULL, 861, 300, 'H-T3', 'S', 'P', 'A', 'C', '1', 'pending', 300),
            (861, 861, NULL, 861, 300, 'H-T1', 'S', 'P', 'A', NULL, NULL, 'pending', 100);
    `);
});

after(async () => {
    await pool.end();
});

test('history: summary, raw lists and the merged, newest-first transaction list', async () => {
    const res = await request(app).get('/user/payment/history').set('Authorization', `Bearer ${sign(USER, [], [])}`);
    assert.strictEqual(res.status, 200);
    const { data } = res.body;

    assert.deepStrictEqual(data.user_info, { name: 'History User', phone: '01760000861', email: 'h861@test.local', profile: { a: 1 } });
    assert.deepStrictEqual(data.summary, {
        total_spent: 2700, total_individual_spent: 900, total_bundle_spent: 1500, total_book_spent: 300,
        total_courses_enrolled: 2, total_bundles_purchased: 1, total_books_purchased: 1, total_transactions: 4,
    });

    // The raw lists keep the coupon_* columns; only all_transactions folds them.
    assert.deepStrictEqual(Object.keys(data.individual_courses[1]).sort(), [
        'coupon_code', 'coupon_discount_amount', 'coupon_discount_type', 'coupon_discount_value', 'coupon_final_price',
        'coupon_id', 'coupon_id_detail', 'coupon_name', 'coupon_original_price', 'course_id', 'course_url', 'enrollment_date',
        'id', 'instructor_list', 'original_price', 'paid_amount', 'purchase_type', 'short_description', 'title',
        'transaction_id', 'user_id',
    ]);
    assert.deepStrictEqual(data.book_purchases.map((b) => [b.book_id, b.transaction_id]), [[861, 'H-T3']]);

    assert.deepStrictEqual(
        data.all_transactions.map((t) => [t.item_type, t.transaction_id, t.transaction_date]),
        [['book', 'H-T3', 300], ['course', 'H-T2', 200], ['bundle', 'H-T2', 200], ['course', 'H-T1', 100]]
    );
    const withCoupon = data.all_transactions[3];
    assert.deepStrictEqual(withCoupon.coupon, {
        id: 861, code: 'HIST100', name: 'Hist', discount_type: 'fixed', discount_value: '100.00',
        discount_amount: 100, original_price: 1000, final_price: 900,
    });
    assert.strictEqual(Object.keys(withCoupon).some((k) => k.startsWith('coupon_')), false);
    assert.deepStrictEqual(
        [data.all_transactions[1].coupon, data.all_transactions[2].coupon, data.all_transactions[0].coupon],
        [null, null, null]
    );
    assert.deepStrictEqual(data.all_transactions[2].courses.map((c) => [c.id, c.enrollment_date]), [[862, 200]]);
    assert.strictEqual(Object.keys(data.all_transactions[2]).some((k) => k.startsWith('coupon_')), false);
    assert.strictEqual(data.all_transactions[0].fulfillment_status, 'pending');
});
