// Checkout initiation edge cases not covered by payment.test.js: which check wins when a
// request has several problems, unknown items, and what the client gets when the gateway's
// session-init reply is unusable. Pinned before the three initiatePayment* methods share
// one flow (REFACTOR_PLAN.md task 4.2).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, sign, pool } = require('../helpers/fixtures');
const sslcommerzStub = require('../helpers/sslcommerzStub');

const COURSE = 721; // 1200, no books attached
const COURSE_WITH_BOOK = 722; // 1000, offers BOOK_FOR_COURSE
const BUNDLE = 721; // 2000, contains COURSE
const BOOK_FOR_COURSE = 721; // 250
const BOOK = 722; // 350, sold standalone
const INACTIVE_BOOK = 723;

let gw;
const now = () => Math.floor(Date.now() / 1000);

// The initiate route allows 5 calls per user per 15 min, so every test uses its own student.
let nextUser = 721;
const newStudent = async () => {
    const id = nextUser++;
    await pool.query(
        `INSERT INTO managerial_auth (id, name, type, login, password, profile)
         VALUES ($1, $2, 3, $3, 'x', $4)`,
        [id, `Buyer ${id}`, `0172000${id}`, JSON.stringify({ email: `p${id}@profile.test`, phone: '0199' })]
    );
    return { id, name: `Buyer ${id}`, type: 3, login: `0172000${id}` };
};

const initiate = (user, path, body = {}) => request(app)
    .post(`/user/payment/${path}`)
    .set('Authorization', `Bearer ${sign(user, [], [])}`)
    .send(body);
const reply = (res) => ({ status: res.status, body: res.body });
const lastInit = () => gw.inits[gw.inits.length - 1];
const shipping = { name: 'S', phone: '0170', address: 'Road 1' };

before(async () => {
    await seed();
    const t = now();
    await pool.query(`
        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free) VALUES
            (${COURSE}, 'Checkout Course', 1200, 1500, true, true, 721, 'checkout-course', 'checkout-course', '[]', false),
            (${COURSE_WITH_BOOK}, 'Checkout Course 2', 1000, 1200, true, true, 722, 'checkout-course-2', 'checkout-course-2', '[]', false);
        INSERT INTO bundle (id, title, price, is_live, is_active) VALUES (${BUNDLE}, 'Checkout Bundle', 2000, true, true);
        INSERT INTO bundle_course (bundle_id, course_id) VALUES (${BUNDLE}, ${COURSE});
        INSERT INTO book (id, title, price, is_active, created_at, updated_at) VALUES
            (${BOOK_FOR_COURSE}, 'Checkout Workbook', 250, true, ${t}, ${t}),
            (${BOOK}, 'Checkout Book', 350, true, ${t}, ${t}),
            (${INACTIVE_BOOK}, 'Retired Book', 100, false, ${t}, ${t});
        INSERT INTO course_book (course_id, book_id) VALUES (${COURSE_WITH_BOOK}, ${BOOK_FOR_COURSE});
        INSERT INTO coupons (id, name, code, discount_type, discount_value, start_time, end_time, created_at, updated_at, status)
        VALUES (721, 'Checkout 200', 'CHECKOUT200', 'fixed', 200, ${t - 60}, ${t + 86400}, ${t}, ${t}, 'active');
        INSERT INTO coupon_courses (coupon_id, course_id, created_at) VALUES (721, ${COURSE_WITH_BOOK}, ${t});
    `);
    gw = sslcommerzStub.install();
});

after(async () => {
    gw.restore();
    await pool.end();
});

test('an invalid coupon is reported for bundle and book as well (before the gateway is called)', async () => {
    const before = gw.inits.length;
    const user = await newStudent();
    // The bundle/book validators word an unknown code differently from the course one.
    for (const path of [`initiate-for-bundle/${BUNDLE}`, `initiate-for-book/${BOOK}`]) {
        assert.deepStrictEqual(
            reply(await initiate(user, path, { coupon_code: 'NOPE', shipping })),
            { status: 400, body: { success: false, error: 'Coupon not found' } }, path
        );
    }
    // A real coupon that doesn't target the item.
    const wrongItem = reply(await initiate(user, `initiate-for-bundle/${BUNDLE}`, { coupon_code: 'CHECKOUT200' }));
    assert.deepStrictEqual([wrongItem.status, wrongItem.body.success], [400, false]);
    assert.strictEqual(typeof wrongItem.body.error, 'string');
    assert.strictEqual(gw.inits.length, before);
});

test('course: the coupon is checked before the books; book: shipping before the coupon', async () => {
    const user = await newStudent();
    assert.deepStrictEqual(
        reply(await initiate(user, `initiate/${COURSE_WITH_BOOK}`, { coupon_code: 'NOPE', include_books: true })),
        { status: 400, body: { success: false, error: 'Invalid coupon code' } }
    );
    assert.deepStrictEqual(
        reply(await initiate(user, `initiate-for-book/${BOOK}`, { coupon_code: 'NOPE' })),
        { status: 400, body: { success: false, error: 'Shipping name, phone and address are required' } }
    );
});

test('include_books for an item with no books, and on a bundle', async () => {
    const user = await newStudent();
    assert.deepStrictEqual(
        reply(await initiate(user, `initiate/${COURSE}`, { include_books: true, shipping })),
        { status: 400, body: { success: false, error: 'No books are available to include for this item' } }
    );
    assert.deepStrictEqual(
        reply(await initiate(user, `initiate-for-bundle/${BUNDLE}`, { include_books: true, shipping })),
        { status: 400, body: { success: false, error: 'No books are available to include for this item' } }
    );
    // include_books must be the boolean true; anything else means "no books".
    const res = await initiate(user, `initiate/${COURSE}`, { include_books: 'true', shipping });
    assert.strictEqual(res.body.books_included, false);
    assert.strictEqual(lastInit().shipping_method, 'NO');
});

test('book: unknown or inactive books are rejected; no row is staged', async () => {
    const user = await newStudent();
    for (const id of [99999, INACTIVE_BOOK]) {
        assert.deepStrictEqual(
            reply(await initiate(user, `initiate-for-book/${id}`, { shipping })),
            { status: 400, body: { success: false, error: 'Book not found or unavailable' } }
        );
    }
    const staged = await pool.query('SELECT 1 FROM payment_book_selection WHERE user_id = $1', [user.id]);
    assert.strictEqual(staged.rowCount, 0);
});

test('course / bundle that does not exist', async () => {
    const user = await newStudent();
    // CURRENT BEHAVIOUR: the missing row is dereferenced and the request fails with a 500.
    for (const path of ['initiate/99999', 'initiate-for-bundle/99999']) {
        const res = await initiate(user, path, {});
        assert.strictEqual(res.status, 500, path);
        assert.strictEqual(res.body.success, false, path);
    }
});

test('bundle without coupon: response and gateway fields', async () => {
    const user = await newStudent();
    const res = await initiate(user, `initiate-for-bundle/${BUNDLE}`, {});
    const init = lastInit();
    assert.deepStrictEqual(reply(res), {
        status: 200,
        body: {
            success: true,
            data: `https://sandbox.sslcommerz.com/EasyCheckOut/test-${init.tran_id}`,
            coupon_applied: false, original_price: 2000, final_price: 2000, discount_amount: 0,
            books_included: false, books_total: 0,
        },
    });
    assert.match(init.tran_id, new RegExp(`^[A-Z0-9]{14}${user.id}${BUNDLE}$`));
    // A user without email/phone columns falls back to the profile JSON.
    assert.deepStrictEqual(
        [init.value_d, init.product_name, init.product_profile, init.cus_email, init.cus_phone, init.cus_add1, init.cus_postcode, init.ship_name],
        ['BUNDLE', 'Math Pro Bundle', 'digital-goods', `p${user.id}@profile.test`, '0199', 'Dhaka', '1000', user.name]
    );
});

test('book: response has no books_* fields; shipping goes to the gateway', async () => {
    const user = await newStudent();
    const res = await initiate(user, `initiate-for-book/${BOOK}`, { shipping: { ...shipping, city: 'Sylhet', postcode: '3100' } });
    const init = lastInit();
    assert.deepStrictEqual(res.body, {
        success: true,
        data: `https://sandbox.sslcommerz.com/EasyCheckOut/test-${init.tran_id}`,
        coupon_applied: false, original_price: 350, final_price: 350, discount_amount: 0,
    });
    assert.deepStrictEqual(
        [init.total_amount, init.value_d, init.product_name, init.product_profile, init.shipping_method, init.cus_add1, init.cus_city, init.ship_postcode, init.ship_name, init.cus_phone],
        ['350.00', 'BOOK', 'Math Pro Book', 'physical-goods', 'Courier', 'Road 1', 'Sylhet', '3100', 'S', '0199']
    );
});

test('course + coupon + books: amounts with a fixed coupon', async () => {
    const user = await newStudent();
    const res = await initiate(user, `initiate/${COURSE_WITH_BOOK}`, { coupon_code: 'CHECKOUT200', include_books: true, shipping });
    assert.deepStrictEqual(
        [res.body.original_price, res.body.final_price, res.body.discount_amount, res.body.books_total, lastInit().total_amount],
        [1000, 1050, 200, 250, '1050.00']
    );
});

test('an unusable gateway reply', async () => {
    const user = await newStudent();
    for (const [path, body, extra] of [
        [`initiate/${COURSE}`, {}, { books_included: false, books_total: 0 }],
        [`initiate-for-bundle/${BUNDLE}`, {}, { books_included: false, books_total: 0 }],
        [`initiate-for-book/${BOOK}`, { shipping }, {}],
    ]) {
        gw.initReply = 'gateway down';
        const res = await initiate(user, path, body);
        // CURRENT BEHAVIOUR: sslcommerz-lts turns the failure into a resolved value, so the
        // client gets success with no `data` (no gateway URL) instead of an error.
        assert.strictEqual(res.status, 200, path);
        const price = path.startsWith('initiate-for-book') ? 350 : path.startsWith('initiate-for-bundle') ? 2000 : 1200;
        assert.deepStrictEqual(res.body, {
            success: true, coupon_applied: false, original_price: price, final_price: price, discount_amount: 0, ...extra,
        }, path);
    }
});
