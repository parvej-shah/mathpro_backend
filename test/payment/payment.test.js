// Characterization tests for the SSLCommerz payment flow (REFACTOR_PLAN.md task 0.4).
//
// They pin what the code does TODAY, end to end through the HTTP routes, so Phase 4 can
// restructure payments without changing behaviour: what the gateway is asked to charge,
// the IPN responses SSLCommerz receives, and every DB side effect (takes, bundle_purchase,
// coupon_usage, payment_book_selection, course_book_purchase, payment_audit_log).
// SSLCommerz itself is faked at the https boundary (test/helpers/sslcommerzStub.js).
//
// Where today's behaviour looks wrong it is still pinned, with a "CURRENT BEHAVIOUR" note,
// so that fixing it is a deliberate, visible change rather than an accident.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, sign, pool } = require('../helpers/fixtures');
const sslcommerzStub = require('../helpers/sslcommerzStub');

const FRONTEND = process.env.FRONTEND_URL;
const COURSE = 701; // 2000, offers BOOK_FOR_COURSE
const COURSE_2 = 702; // 1500
const BUNDLE = 701; // 3000, contains COURSE + COURSE_2
const BOOK_FOR_COURSE = 701; // 300
const BOOK = 702; // 400, sold standalone

let gw;
const now = () => Math.floor(Date.now() / 1000);

// Each flow uses its own student: the initiate route allows 5 calls per user per 15 min,
// and takes / bundle_purchase are unique per user.
let nextUser = 701;
const newStudent = async () => {
    const id = nextUser++;
    await pool.query(
        `INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile)
         VALUES ($1, $2, 3, $3, 'x', $4, $3, '{}')`,
        [id, `Payer ${id}`, `0171000${id}`, `payer${id}@test.local`]
    );
    return { id, name: `Payer ${id}`, type: 3, login: `0171000${id}` };
};

const initiate = (user, path, body = {}) => request(app)
    .post(`/user/payment/${path}`)
    .set('Authorization', `Bearer ${sign(user, [], [])}`)
    .send(body);

// SSLCommerz posts the IPN as a urlencoded form.
const ipn = (fields) => request(app).post('/user/payment/ipn').type('form').send(fields);

const validated = (amount, extra = {}) => ({
    status: 'VALID', val_id: 'VAL-1', amount: String(amount), store_amount: String(amount),
    bank_tran_id: 'BANK-1', risk_level: '0', risk_title: 'Safe', ...extra,
});

const rows = async (sql, params) => (await pool.query(sql, params)).rows;
const auditLog = async (tranId) => (await rows(
    `SELECT internal_transaction_id, user_id, item_id, item_type, amount::float AS amount, status, processing_status, error_message
     FROM payment_audit_log WHERE sslcommerz_tran_id = $1 ORDER BY id`, [tranId]
));
const couponUsage = async (tranId) => (await rows(
    `SELECT c.code, u.user_id, u.course_id, u.bundle_id, u.book_id, u.original_price::float AS original_price,
            u.discount_amount::float AS discount_amount, u.final_price::float AS final_price, u.payment_status
     FROM coupon_usage u JOIN coupons c ON c.id = u.coupon_id WHERE u.transaction_id = $1`, [tranId]
));
const takes = async (userId) => (await rows(
    `SELECT t.course_id, t.amount, t.transaction_id, c.code AS coupon
     FROM takes t LEFT JOIN coupons c ON c.id = t.coupon_id WHERE t.user_id = $1 ORDER BY t.course_id`, [userId]
));
const bookPurchases = async (tranId) => (await rows(
    `SELECT user_id, course_id, bundle_id, book_id, amount_paid, ship_name, ship_address, fulfillment_status
     FROM course_book_purchase WHERE transaction_id = $1 ORDER BY book_id`, [tranId]
));
const stagedBooks = async (tranId) => (await rows(
    `SELECT user_id, item_type, item_id, books_total, book_ids, ship_name, ship_phone, ship_address, ship_city
     FROM payment_book_selection WHERE transaction_id = $1`, [tranId]
));
const lastInit = () => gw.inits[gw.inits.length - 1];

before(async () => {
    await seed();
    const t = now();
    await pool.query(`
        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free) VALUES
            (${COURSE}, 'Paid Course', 2000, 2500, true, true, 701, 'paid-course', 'paid-course', '[]', false),
            (${COURSE_2}, 'Second Course', 1500, 1800, true, true, 702, 'second-course', 'second-course', '[]', false);
        INSERT INTO bundle (id, title, price, is_live, is_active) VALUES (${BUNDLE}, 'Paid Bundle', 3000, true, true);
        INSERT INTO bundle_course (bundle_id, course_id) VALUES (${BUNDLE}, ${COURSE}), (${BUNDLE}, ${COURSE_2});
        INSERT INTO book (id, title, price, is_active, created_at, updated_at) VALUES
            (${BOOK_FOR_COURSE}, 'Course Workbook', 300, true, ${t}, ${t}),
            (${BOOK}, 'Standalone Book', 400, true, ${t}, ${t});
        INSERT INTO course_book (course_id, book_id) VALUES (${COURSE}, ${BOOK_FOR_COURSE});
        INSERT INTO coupons (id, name, code, discount_type, discount_value, start_time, end_time, created_at, updated_at, status)
        VALUES (701, 'Course 10%', 'PAYCOURSE10', 'percentage', 10, ${t - 60}, ${t + 86400}, ${t}, ${t}, 'active'),
               (702, 'Bundle 500', 'PAYBUNDLE500', 'fixed', 500, ${t - 60}, ${t + 86400}, ${t}, ${t}, 'active'),
               (703, 'Book 100', 'PAYBOOK100', 'fixed', 100, ${t - 60}, ${t + 86400}, ${t}, ${t}, 'active');
        INSERT INTO coupon_courses (coupon_id, course_id, created_at) VALUES (701, ${COURSE}, ${t});
        INSERT INTO coupon_bundles (coupon_id, bundle_id, created_at) VALUES (702, ${BUNDLE}, ${t});
        INSERT INTO coupon_books (coupon_id, book_id, created_at) VALUES (703, ${BOOK}, ${t});
    `);
    gw = sslcommerzStub.install();
});

after(async () => {
    gw.restore();
    await pool.end();
});

// ---------------------------------------------------------------- course

test('course: initiate without coupon asks the gateway for the DB price', async () => {
    const user = await newStudent();
    const res = await initiate(user, `initiate/${COURSE}`, { price: 1 }); // client price is ignored

    assert.strictEqual(res.status, 200);
    const init = lastInit();
    assert.deepStrictEqual(res.body, {
        success: true,
        data: `https://sandbox.sslcommerz.com/EasyCheckOut/test-${init.tran_id}`,
        coupon_applied: false,
        original_price: 2000,
        final_price: 2000,
        discount_amount: 0,
        books_included: false,
        books_total: 0,
    });
    assert.match(init.tran_id, new RegExp(`^[A-Z0-9]{14}${user.id}${COURSE}$`));
    assert.deepStrictEqual(
        {
            total_amount: init.total_amount, currency: init.currency,
            value_a: init.value_a, value_b: init.value_b, value_c: init.value_c, value_d: init.value_d,
            product_name: init.product_name, product_profile: init.product_profile, shipping_method: init.shipping_method,
            success_url: init.success_url, fail_url: init.fail_url, cancel_url: init.cancel_url,
            cus_name: init.cus_name, cus_email: init.cus_email, cus_phone: init.cus_phone,
            store_id: init.store_id,
        },
        {
            total_amount: '2000.00', currency: 'BDT',
            value_a: String(user.id), value_b: String(COURSE), value_c: '2000.00', value_d: 'COURSE',
            product_name: 'Math Pro Course', product_profile: 'digital-goods', shipping_method: 'NO',
            success_url: 'http://backend.test/user/payment/success',
            fail_url: 'http://backend.test/user/payment/failure',
            cancel_url: 'http://backend.test/user/payment/cancel',
            cus_name: user.name, cus_email: `payer${user.id}@test.local`, cus_phone: user.login,
            store_id: 'test',
        }
    );
    assert.deepStrictEqual(await couponUsage(init.tran_id), []);
    assert.deepStrictEqual(await stagedBooks(init.tran_id), []);
});

test('course + coupon + books: discount on the course only, books added on top; IPN enrols and fulfils', async () => {
    const user = await newStudent();
    const shipping = { name: 'Ship To', phone: '01800000000', address: 'Road 1', city: 'Dhaka' };
    const res = await initiate(user, `initiate/${COURSE}`, { coupon_code: 'PAYCOURSE10', include_books: true, shipping });

    assert.strictEqual(res.status, 200);
    const tranId = lastInit().tran_id;
    assert.deepStrictEqual(
        { ...res.body, data: undefined },
        {
            success: true, data: undefined, coupon_applied: true,
            original_price: 2000, final_price: 2100, discount_amount: 200,
            books_included: true, books_total: 300,
        }
    );
    assert.strictEqual(lastInit().total_amount, '2100.00');
    assert.strictEqual(lastInit().value_c, '2100.00');
    assert.strictEqual(lastInit().product_profile, 'physical-goods');
    assert.strictEqual(lastInit().shipping_method, 'Courier');
    assert.strictEqual(lastInit().ship_add1, 'Road 1');
    assert.deepStrictEqual(await couponUsage(tranId), [{
        code: 'PAYCOURSE10', user_id: user.id, course_id: COURSE, bundle_id: null, book_id: null,
        original_price: 2000, discount_amount: 200, final_price: 1800, payment_status: 'pending',
    }]);
    assert.deepStrictEqual(await stagedBooks(tranId), [{
        user_id: user.id, item_type: 'COURSE', item_id: COURSE, books_total: 300, book_ids: [BOOK_FOR_COURSE],
        ship_name: 'Ship To', ship_phone: '01800000000', ship_address: 'Road 1', ship_city: 'Dhaka',
    }]);

    gw.setValidation(tranId, validated('2100.00'));
    const paid = await ipn({
        tran_id: tranId, val_id: 'VAL-1', status: 'VALID', amount: '2100.00',
        value_a: user.id, value_b: COURSE, value_c: '2100.00', value_d: 'COURSE',
    });

    assert.strictEqual(paid.status, 200);
    assert.deepStrictEqual(paid.body, { success: true, message: 'Course purchase processed successfully', risk_level: 0 });
    assert.deepStrictEqual(await takes(user.id), [
        { course_id: COURSE, amount: 2100, transaction_id: tranId, coupon: 'PAYCOURSE10' },
    ]);
    assert.strictEqual((await couponUsage(tranId))[0].payment_status, 'completed');
    assert.deepStrictEqual(await bookPurchases(tranId), [{
        user_id: user.id, course_id: COURSE, bundle_id: null, book_id: BOOK_FOR_COURSE, amount_paid: 300,
        ship_name: 'Ship To', ship_address: 'Road 1', fulfillment_status: 'pending',
    }]);
    assert.deepStrictEqual(await auditLog(tranId), [{
        internal_transaction_id: tranId, user_id: user.id, item_id: COURSE, item_type: 'COURSE',
        amount: 2100, status: 'VALID', processing_status: 'SUCCESS', error_message: null,
    }]);

    // SSLCommerz retries IPNs. Once the validation API reports VALIDATED it is acknowledged
    // without touching enrolment again.
    gw.setValidation(tranId, validated('2100.00', { status: 'VALIDATED' }));
    const retried = await ipn({ tran_id: tranId, status: 'VALID', value_a: user.id, value_b: COURSE, value_c: '2100.00', value_d: 'COURSE' });
    assert.deepStrictEqual(retried.body, { success: true, message: 'Transaction already processed', already_processed: true });
    assert.strictEqual((await auditLog(tranId))[1].processing_status, 'ALREADY_PROCESSED');
    assert.strictEqual((await takes(user.id)).length, 1);
});

test('course: a replayed IPN while validation still says VALID', async () => {
    const user = await newStudent();
    await initiate(user, `initiate/${COURSE_2}`);
    const tranId = lastInit().tran_id;
    gw.setValidation(tranId, validated('1500.00'));
    const fields = { tran_id: tranId, status: 'VALID', value_a: user.id, value_b: COURSE_2, value_c: '1500.00', value_d: 'COURSE' };

    assert.strictEqual((await ipn(fields)).body.success, true);
    const replay = await ipn(fields);

    // CURRENT BEHAVIOUR: the second `takes` insert hits the (user_id, course_id) key, so the
    // replay is answered as a failure and logged FAILED, although the student is enrolled.
    assert.strictEqual(replay.status, 200);
    assert.deepStrictEqual(replay.body, { success: false, error: 'A record with the same value already exists.' });
    assert.deepStrictEqual((await auditLog(tranId)).map((r) => r.processing_status), ['SUCCESS', 'FAILED']);
    assert.deepStrictEqual(await takes(user.id), [{ course_id: COURSE_2, amount: 1500, transaction_id: tranId, coupon: null }]);
});

test('course: an invalid coupon is rejected before the gateway is called', async () => {
    const user = await newStudent();
    const before = gw.inits.length;
    const res = await initiate(user, `initiate/${COURSE}`, { coupon_code: 'NOPE' });

    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(res.body, { success: false, error: 'Invalid coupon code' });
    assert.strictEqual(gw.inits.length, before);
});

test('course: include_books without a shipping address is rejected', async () => {
    const user = await newStudent();
    const res = await initiate(user, `initiate/${COURSE}`, { include_books: true });

    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(res.body, { success: false, error: 'Shipping name, phone and address are required when including books' });
});

test('initiate requires a logged-in user', async () => {
    const res = await request(app).post(`/user/payment/initiate/${COURSE}`).send({});
    assert.strictEqual(res.status, 401);
});

// ---------------------------------------------------------------- bundle

test('bundle + coupon: IPN records the purchase and enrols every bundle course at amount 0', async () => {
    const user = await newStudent();
    const res = await initiate(user, `initiate-for-bundle/${BUNDLE}`, { coupon_code: 'PAYBUNDLE500' });

    assert.strictEqual(res.status, 200);
    const init = lastInit();
    assert.deepStrictEqual(
        { ...res.body, data: undefined },
        {
            success: true, data: undefined, coupon_applied: true,
            original_price: 3000, final_price: 2500, discount_amount: 500,
            books_included: false, books_total: 0,
        }
    );
    assert.deepStrictEqual(
        [init.total_amount, init.value_b, init.value_c, init.value_d, init.product_name],
        ['2500.00', String(BUNDLE), '2500.00', 'BUNDLE', 'Math Pro Bundle']
    );
    assert.deepStrictEqual(await couponUsage(init.tran_id), [{
        code: 'PAYBUNDLE500', user_id: user.id, course_id: null, bundle_id: BUNDLE, book_id: null,
        original_price: 3000, discount_amount: 500, final_price: 2500, payment_status: 'pending',
    }]);

    gw.setValidation(init.tran_id, validated('2500.00'));
    const paid = await ipn({
        tran_id: init.tran_id, status: 'VALID', value_a: user.id, value_b: BUNDLE, value_c: '2500.00', value_d: 'BUNDLE',
    });

    assert.deepStrictEqual(paid.body, { success: true, message: 'Bundle purchase processed successfully', risk_level: 0 });
    assert.deepStrictEqual(
        await rows('SELECT bundle_id, amount, transaction_id, coupon_id FROM bundle_purchase WHERE user_id = $1', [user.id]),
        [{ bundle_id: BUNDLE, amount: 2500, transaction_id: init.tran_id, coupon_id: null }]
    );
    assert.deepStrictEqual(await takes(user.id), [
        { course_id: COURSE, amount: 0, transaction_id: init.tran_id, coupon: null },
        { course_id: COURSE_2, amount: 0, transaction_id: init.tran_id, coupon: null },
    ]);
    assert.strictEqual((await couponUsage(init.tran_id))[0].payment_status, 'completed');
    assert.strictEqual((await auditLog(init.tran_id))[0].processing_status, 'SUCCESS');
});

test('bundle + books: books from the bundle courses are staged and fulfilled with bundle_id', async () => {
    const user = await newStudent();
    const shipping = { name: 'B Ship', phone: '01800000001', address: 'Road 2' };
    const res = await initiate(user, `initiate-for-bundle/${BUNDLE}`, { include_books: true, shipping });

    assert.strictEqual(res.body.final_price, 3300);
    const tranId = lastInit().tran_id;
    assert.strictEqual(lastInit().total_amount, '3300.00');
    assert.strictEqual((await stagedBooks(tranId))[0].item_type, 'BUNDLE');

    gw.setValidation(tranId, validated('3300.00'));
    await ipn({ tran_id: tranId, status: 'VALID', value_a: user.id, value_b: BUNDLE, value_c: '3300.00', value_d: 'BUNDLE' });

    assert.deepStrictEqual(await bookPurchases(tranId), [{
        user_id: user.id, course_id: COURSE, bundle_id: BUNDLE, book_id: BOOK_FOR_COURSE, amount_paid: 300,
        ship_name: 'B Ship', ship_address: 'Road 2', fulfillment_status: 'pending',
    }]);
    assert.deepStrictEqual(
        await rows('SELECT amount FROM bundle_purchase WHERE user_id = $1', [user.id]),
        [{ amount: 3300 }]
    );
});

// ---------------------------------------------------------------- book

test('book + coupon: needs shipping; IPN records a purchase with no course or bundle', async () => {
    const user = await newStudent();

    const noShipping = await initiate(user, `initiate-for-book/${BOOK}`, {});
    assert.strictEqual(noShipping.status, 400);
    assert.deepStrictEqual(noShipping.body, { success: false, error: 'Shipping name, phone and address are required' });

    const shipping = { name: 'Book Buyer', phone: '01800000002', address: 'Road 3', city: 'Khulna' };
    const res = await initiate(user, `initiate-for-book/${BOOK}`, { coupon_code: 'PAYBOOK100', shipping });

    assert.strictEqual(res.status, 200);
    const init = lastInit();
    assert.deepStrictEqual(
        { ...res.body, data: undefined },
        { success: true, data: undefined, coupon_applied: true, original_price: 400, final_price: 300, discount_amount: 100 }
    );
    assert.deepStrictEqual(
        [init.total_amount, init.value_b, init.value_d, init.product_name, init.product_profile, init.shipping_method, init.ship_city],
        ['300.00', String(BOOK), 'BOOK', 'Math Pro Book', 'physical-goods', 'Courier', 'Khulna']
    );
    assert.deepStrictEqual(await couponUsage(init.tran_id), [{
        code: 'PAYBOOK100', user_id: user.id, course_id: null, bundle_id: null, book_id: BOOK,
        original_price: 400, discount_amount: 100, final_price: 300, payment_status: 'pending',
    }]);
    assert.deepStrictEqual(await stagedBooks(init.tran_id), [{
        // books_total is the catalogue price; the coupon discount isn't applied to it.
        user_id: user.id, item_type: 'BOOK', item_id: BOOK, books_total: 400, book_ids: [BOOK],
        ship_name: 'Book Buyer', ship_phone: '01800000002', ship_address: 'Road 3', ship_city: 'Khulna',
    }]);

    gw.setValidation(init.tran_id, validated('300.00'));
    const paid = await ipn({ tran_id: init.tran_id, status: 'VALID', value_a: user.id, value_b: BOOK, value_c: '300.00', value_d: 'BOOK' });

    assert.deepStrictEqual(paid.body, { success: true, message: 'Book purchase processed successfully', risk_level: 0 });
    // amount_paid is the catalogue price snapshot, not the discounted price.
    assert.deepStrictEqual(await bookPurchases(init.tran_id), [{
        user_id: user.id, course_id: null, bundle_id: null, book_id: BOOK, amount_paid: 400,
        ship_name: 'Book Buyer', ship_address: 'Road 3', fulfillment_status: 'pending',
    }]);
    assert.deepStrictEqual(await takes(user.id), []);
    assert.strictEqual((await couponUsage(init.tran_id))[0].payment_status, 'completed');
});

// ---------------------------------------------------------------- IPN rejections

test('IPN: amount mismatch against the validation API is rejected without enrolling', async () => {
    const user = await newStudent();
    await initiate(user, `initiate/${COURSE}`);
    const tranId = lastInit().tran_id;
    gw.setValidation(tranId, validated('20.00'));

    const res = await ipn({ tran_id: tranId, status: 'VALID', value_a: user.id, value_b: COURSE, value_c: '2000.00', value_d: 'COURSE' });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
        success: false,
        error: 'Amount mismatch: IPN amount (2000) != Validated amount (20)',
        ipn_amount: 2000,
        validated_amount: 20,
    });
    assert.deepStrictEqual(await takes(user.id), []);
    assert.strictEqual((await auditLog(tranId))[0].processing_status, 'ERROR');
});

test('IPN: without value_c the validated amount is what gets recorded', async () => {
    const user = await newStudent();
    await initiate(user, `initiate/${COURSE_2}`);
    const tranId = lastInit().tran_id;
    gw.setValidation(tranId, validated('1500.00'));

    const res = await ipn({ tran_id: tranId, status: 'VALID', value_a: user.id, value_b: COURSE_2, value_d: 'COURSE' });

    assert.strictEqual(res.body.success, true);
    assert.strictEqual((await takes(user.id))[0].amount, 1500);
});

test('IPN: a transaction the validation API reports as FAILED is not processed', async () => {
    const user = await newStudent();
    await initiate(user, `initiate/${COURSE}`);
    const tranId = lastInit().tran_id;
    gw.setValidation(tranId, validated('2000.00', { status: 'FAILED', error: 'Card declined' }));

    // The IPN body claims VALID; the validation API is what decides.
    const res = await ipn({ tran_id: tranId, status: 'VALID', value_a: user.id, value_b: COURSE, value_c: '2000.00', value_d: 'COURSE' });

    assert.deepStrictEqual(res.body, { success: false, error: 'Card declined', transaction_status: 'FAILED' });
    assert.deepStrictEqual(await takes(user.id), []);
    assert.strictEqual((await auditLog(tranId))[0].processing_status, 'FAILED');
});

test('IPN: an unknown transaction fails validation', async () => {
    const user = await newStudent();
    const res = await ipn({ tran_id: 'UNKNOWN-TRAN', status: 'VALID', value_a: user.id, value_b: COURSE, value_c: '2000.00', value_d: 'COURSE' });

    assert.deepStrictEqual(res.body, {
        success: false,
        error: 'SSLCommerz validation failed: No transaction record found',
        validation_error: 'No transaction record found',
    });
    assert.deepStrictEqual(await takes(user.id), []);
    assert.strictEqual((await auditLog('UNKNOWN-TRAN'))[0].processing_status, 'ERROR');
});

test('IPN: a risky payment is still processed and reports its risk level', async () => {
    const user = await newStudent();
    await initiate(user, `initiate/${COURSE_2}`);
    const tranId = lastInit().tran_id;
    gw.setValidation(tranId, validated('1500.00', { risk_level: '1', risk_title: 'Risky' }));

    const res = await ipn({ tran_id: tranId, status: 'VALID', value_a: user.id, value_b: COURSE_2, value_c: '1500.00', value_d: 'COURSE' });

    assert.deepStrictEqual(res.body, { success: true, message: 'Course purchase processed successfully', risk_level: 1 });
    assert.strictEqual((await takes(user.id)).length, 1);
    assert.strictEqual((await auditLog(tranId))[0].processing_status, 'SUCCESS');
});

test('IPN: a FAILED status with no transaction id is logged and not validated', async () => {
    const user = await newStudent();
    const calls = gw.validationCalls.length;
    const res = await ipn({ status: 'FAILED', value_a: user.id, value_b: COURSE, value_c: '2000.00', value_d: 'COURSE' });

    assert.deepStrictEqual(res.body, { success: false, message: 'Payment status: FAILED' });
    assert.strictEqual(gw.validationCalls.length, calls);
    assert.deepStrictEqual(await takes(user.id), []);
    const log = await rows(
        `SELECT item_type, status, processing_status, error_message FROM payment_audit_log
         WHERE user_id = $1 ORDER BY id`, [user.id]
    );
    assert.deepStrictEqual(log, [{ item_type: 'COURSE', status: 'FAILED', processing_status: 'FAILED', error_message: 'Payment status: FAILED' }]);
});

test('IPN: a missing status field is answered 200 with an error', async () => {
    const res = await ipn({ tran_id: 'NO-STATUS-TRAN' });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { success: false, error: 'Missing status field' });
    // CURRENT BEHAVIOUR: the handler tries to audit this, but passes no item_type and
    // payment_audit_log.item_type is NOT NULL, so the insert fails and nothing is logged.
    // Same for any IPN without value_d or value_b.
    assert.deepStrictEqual(await auditLog('NO-STATUS-TRAN'), []);
});

// ---------------------------------------------------------------- browser callbacks

test('success callback redirects to the invoice, or to post-payment without a tran_id', async () => {
    const withTran = await request(app).post('/user/payment/success').type('form')
        .send({ tran_id: 'ABC 1', status: 'VALID', value_b: COURSE, value_d: 'COURSE' });
    assert.strictEqual(withTran.status, 302);
    assert.strictEqual(withTran.headers.location, `${FRONTEND}/billing/invoice/ABC%201`);

    const cases = [
        ['COURSE', `${FRONTEND}/post-payment/success?type=course&courseId=${COURSE}`],
        ['BUNDLE', `${FRONTEND}/post-payment/success?type=bundle&bundleId=${COURSE}`],
        ['BOOK', `${FRONTEND}/post-payment/success?type=book&bookId=${COURSE}`],
        [undefined, `${FRONTEND}/post-payment/success?type=course&courseId=${COURSE}`],
    ];
    for (const [valueD, location] of cases) {
        const res = await request(app).post('/user/payment/success').type('form').send({ value_b: COURSE, value_d: valueD });
        assert.strictEqual(res.headers.location, location, `value_d=${valueD}`);
    }
});

test('failure and cancel callbacks redirect with the item when it is known', async () => {
    for (const outcome of ['failure', 'cancel']) {
        const known = await request(app).post(`/user/payment/${outcome}`).type('form').send({ value_b: BUNDLE, value_d: 'BUNDLE' });
        assert.strictEqual(known.status, 302);
        assert.strictEqual(known.headers.location, `${FRONTEND}/post-payment/${outcome}?type=bundle&itemId=${BUNDLE}`);

        const unknown = await request(app).post(`/user/payment/${outcome}`).type('form').send({ value_b: BUNDLE });
        assert.strictEqual(unknown.headers.location, `${FRONTEND}/post-payment/${outcome}`);
    }
});

test('no connection is left checked out', async () => {
    assert.strictEqual(pool.totalCount - pool.idleCount, 0);
});
