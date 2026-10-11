// Admin reconciliation (mathpro_admin: POST /admin/payment/reconcile/:sslcommerz_tran_id).
// An admin uses it when a paid student was not enrolled (lost or failed IPN). The audit log
// only records what IPNs *claimed*, so what gets fulfilled is decided by SSLCommerz: the
// tran_id query says whether the payment is valid, its val_id order record says who bought what.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, sign, pool } = require('../helpers/fixtures');
const { PERMISSIONS } = require('../../util/permissions');
const sslcommerzStub = require('../helpers/sslcommerzStub');

const COURSE = 821; // 700
const BUNDLE_COURSE = 822;
const BUNDLE = 821; // 900, contains BUNDLE_COURSE
const BOOK = 822; // 200; same id as course 822 on purpose
// An admin whose DB role grants payment.manage on every course (the reconcile route checks
// the DB roles, and the seeded super admin role carries no permissions JSON).
const RECONCILER = { id: 820, name: 'Reconciler', type: 1, login: 'rec@test.local' };
let gw;

let nextUser = 941; // 941-969 are free; 861+ belong to paymentHistory.test.js
const newStudent = async () => {
    const id = nextUser++;
    await pool.query(
        `INSERT INTO managerial_auth (id, name, type, login, password, profile) VALUES ($1, 'Reconciled', 3, $2, 'x', '{}')`,
        [id, `0175000${id}`]
    );
    return { id, name: 'Reconciled', type: 3, login: `0175000${id}` };
};

before(async () => {
    await seed();
    const t = Math.floor(Date.now() / 1000);
    await pool.query(`
        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free) VALUES
            (${COURSE}, 'Reconcile Course', 700, 700, true, true, 821, 'rec-821', 'rec-821', '[]', false),
            (${BUNDLE_COURSE}, 'Bundled Reconcile Course', 900, 900, true, true, 822, 'rec-822', 'rec-822', '[]', false);
        INSERT INTO bundle (id, title, price, is_live, is_active) VALUES (${BUNDLE}, 'Reconcile Bundle', 900, true, true);
        INSERT INTO bundle_course (bundle_id, course_id) VALUES (${BUNDLE}, ${BUNDLE_COURSE});
        INSERT INTO book (id, title, price, is_active, created_at, updated_at) VALUES (${BOOK}, 'Reconcile Book', 200, true, ${t}, ${t});
    `);
    await pool.query(`INSERT INTO managerial_auth (id, name, type, login, password, profile)
                      VALUES (820, 'Reconciler', 1, 'rec@test.local', 'x', '{}')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, permissions) VALUES (820, 'reconciler_test', 'Reconciler', $1)`,
        [JSON.stringify([PERMISSIONS.PAYMENT.MANAGE.ALL])]);
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES (820, 820)');
    gw = sslcommerzStub.install();
});

after(async () => {
    gw.restore();
    await pool.end();
});

// A real checkout; the gateway then reports the payment as `status`. No IPN is sent.
const checkout = async (user, path, price, body = {}, status = 'VALID') => {
    await request(app).post(`/user/payment/${path}`).set('Authorization', `Bearer ${sign(user, [], [])}`).send(body);
    const init = gw.inits[gw.inits.length - 1];
    gw.setValidation(init.tran_id, { status, amount: `${price}.00`, store_amount: `${price}.00`, risk_level: '0' });
    return init;
};

// An audit row as an IPN would have left it.
let clock = 1000;
const auditRow = async (init, overrides = {}) => {
    const row = {
        user_id: Number(init.value_a), item_id: Number(init.value_b), item_type: init.value_d,
        amount: Number(init.value_c), status: 'VALID', processing_status: 'ERROR', ...overrides,
    };
    await pool.query(
        `INSERT INTO payment_audit_log (sslcommerz_tran_id, internal_transaction_id, user_id, item_id, item_type, amount,
            status, ipn_payload, processing_status, timestamp)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [init.tran_id, row.user_id, row.item_id, row.item_type, row.amount, row.status,
            JSON.stringify({ tran_id: init.tran_id, val_id: `VAL-${init.tran_id}` }), row.processing_status, clock++]
    );
};

const reconcile = (tranId) => request(app)
    .post(`/admin/payment/reconcile/${encodeURIComponent(tranId)}`)
    .set('Authorization', `Bearer ${sign(RECONCILER, [], [PERMISSIONS.PAYMENT.MANAGE.ALL])}`)
    .send({ notes: 'student emailed' });

// Passes the route's JWT guard, but has no role in the DB, so no payment access on any item.
const UNSCOPED = { id: 2, name: 'Test Student', type: 3, login: '01700000000' };
const reconcileAs = (user, tranId) => request(app)
    .post(`/admin/payment/reconcile/${encodeURIComponent(tranId)}`)
    .set('Authorization', `Bearer ${sign(user, [], [PERMISSIONS.PAYMENT.MANAGE.ALL])}`)
    .send({ notes: 'no access' });

const enrolments = async (userId) => (await pool.query(
    'SELECT course_id, amount, transaction_id FROM takes WHERE user_id = $1 ORDER BY course_id', [userId]
)).rows;
const reconciledRows = async (tranId) => (await pool.query(
    `SELECT user_id, item_id, item_type, processing_status, is_manually_reconciled, reconciled_by, notes
     FROM payment_audit_log WHERE sslcommerz_tran_id = $1 ORDER BY timestamp`, [tranId]
)).rows;

test('an unknown transaction is reported', async () => {
    const res = await reconcile('NO-SUCH-TRAN');
    assert.deepStrictEqual([res.status, res.body], [400, { success: false, error: 'Payment log not found for this transaction ID' }]);
});

test('course: a paid student whose IPN failed is enrolled and the row marked reconciled', async () => {
    const user = await newStudent();
    const init = await checkout(user, `initiate/${COURSE}`, 700);
    await auditRow(init);

    const res = await reconcile(init.tran_id);
    assert.strictEqual(res.status, 200);
    const { processing_result: result, ...data } = res.body.data;
    assert.deepStrictEqual(data, {
        log_id: data.log_id, reconciled: true, enrollment_attempted: true, enrollment_succeeded: true,
        processing_status: 'SUCCESS', message: 'Payment reconciled and user enrolled successfully',
    });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(await enrolments(user.id), [{ course_id: COURSE, amount: 700, transaction_id: init.tran_id }]);
    assert.deepStrictEqual(await reconciledRows(init.tran_id), [{
        user_id: user.id, item_id: COURSE, item_type: 'COURSE', processing_status: 'SUCCESS',
        is_manually_reconciled: true, reconciled_by: 820, notes: 'student emailed',
    }]);

    // Reconciling again: already enrolled counts as success.
    const again = await reconcile(init.tran_id);
    assert.deepStrictEqual(
        [again.body.data.enrollment_succeeded, again.body.data.processing_result.message],
        [true, 'Already enrolled']
    );
    assert.strictEqual((await enrolments(user.id)).length, 1);
});

test('bundle: the purchase and every bundle course are recorded', async () => {
    const user = await newStudent();
    const init = await checkout(user, `initiate-for-bundle/${BUNDLE}`, 900);
    await auditRow(init, { status: 'VALID' });
    const res = await reconcile(init.tran_id);
    assert.strictEqual(res.body.data.enrollment_succeeded, true);
    const purchase = await pool.query('SELECT bundle_id, amount FROM bundle_purchase WHERE user_id = $1', [user.id]);
    assert.deepStrictEqual(purchase.rows, [{ bundle_id: BUNDLE, amount: 900 }]);
    assert.deepStrictEqual((await enrolments(user.id)).map((r) => r.course_id), [BUNDLE_COURSE]);
});

test('no VALID row: the gateway still says VALID, so the student is enrolled', async () => {
    const user = await newStudent();
    const init = await checkout(user, `initiate/${COURSE}`, 700);
    await auditRow(init, { status: 'PROCESSING', processing_status: 'FAILED' });
    const res = await reconcile(init.tran_id);
    assert.strictEqual(res.body.data.enrollment_succeeded, true);
    assert.deepStrictEqual((await enrolments(user.id)).map((r) => r.course_id), [COURSE]);
});

test('the gateway says the payment failed: marked reconciled, nobody enrolled', async () => {
    const user = await newStudent();
    const init = await checkout(user, `initiate/${COURSE}`, 700, {}, 'FAILED');
    await auditRow(init, { status: 'FAILED', processing_status: 'FAILED' });
    const res = await reconcile(init.tran_id);
    assert.deepStrictEqual(
        [res.body.data.enrollment_attempted, res.body.data.processing_status, res.body.data.message],
        [false, 'FAILED', 'Payment marked as reconciled']
    );
    assert.deepStrictEqual(await enrolments(user.id), []);
    assert.strictEqual((await reconciledRows(init.tran_id))[0].is_manually_reconciled, true);
});

test('a forged VALID row cannot redirect the enrolment to another item or user', async () => {
    const buyer = await newStudent();
    const other = await newStudent();
    const init = await checkout(buyer, `initiate/${COURSE}`, 700);
    await auditRow(init);
    // Newer row from a forged IPN reusing the real tran_id.
    await auditRow(init, { user_id: other.id, item_id: BUNDLE_COURSE });

    const res = await reconcile(init.tran_id);
    assert.strictEqual(res.body.data.enrollment_succeeded, true);
    assert.deepStrictEqual((await enrolments(buyer.id)).map((r) => r.course_id), [COURSE]);
    assert.deepStrictEqual(await enrolments(other.id), []);
});

test('a VALID row for a transaction the gateway does not know enrols nobody', async () => {
    const user = await newStudent();
    const fake = { tran_id: 'FORGED-TRAN-1', value_a: String(user.id), value_b: String(COURSE), value_c: '700.00', value_d: 'COURSE' };
    await auditRow(fake);
    const res = await reconcile(fake.tran_id);
    assert.deepStrictEqual([res.body.data.enrollment_attempted, res.body.data.enrollment_succeeded], [false, false]);
    assert.deepStrictEqual(await enrolments(user.id), []);
});

test('a standalone book is fulfilled as a book purchase, not a course enrolment', async () => {
    const user = await newStudent();
    const init = await checkout(user, `initiate-for-book/${BOOK}`, 200, { shipping: { name: 'N', phone: 'P', address: 'A' } });
    await auditRow(init);
    const res = await reconcile(init.tran_id);
    assert.strictEqual(res.body.data.enrollment_succeeded, true);
    assert.deepStrictEqual(await enrolments(user.id), []);
    const books = await pool.query('SELECT book_id, course_id, bundle_id FROM course_book_purchase WHERE transaction_id = $1', [init.tran_id]);
    assert.deepStrictEqual(books.rows, [{ book_id: BOOK, course_id: null, bundle_id: null }]);
});

test('a reconciler without access to the item: 403 for a course or bundle, books are not scoped', async () => {
    const course = await checkout(await newStudent(), `initiate/${COURSE}`, 700);
    await auditRow(course);
    const deniedCourse = await reconcileAs(UNSCOPED, course.tran_id);
    assert.deepStrictEqual([deniedCourse.status, deniedCourse.body], [403, {
        success: false, error: 'NO_COURSE_ACCESS', message: 'No access to reconcile payments for this course',
    }]);

    const bundle = await checkout(await newStudent(), `initiate-for-bundle/${BUNDLE}`, 900);
    await auditRow(bundle);
    const deniedBundle = await reconcileAs(UNSCOPED, bundle.tran_id);
    assert.deepStrictEqual([deniedBundle.status, deniedBundle.body], [403, {
        success: false, error: 'NO_BUNDLE_ACCESS', message: 'No access to reconcile payments for this bundle',
    }]);

    const book = await checkout(await newStudent(), `initiate-for-book/${BOOK}`, 200, { shipping: { name: 'N', phone: 'P', address: 'A' } });
    await auditRow(book);
    const bookRes = await reconcileAs(UNSCOPED, book.tran_id);
    assert.strictEqual(bookRes.status, 200);
    assert.strictEqual(bookRes.body.data.enrollment_succeeded, true);

    // The same course and bundle rows go through for a reconciler with access.
    assert.strictEqual((await reconcile(course.tran_id)).status, 200);
    assert.strictEqual((await reconcile(bundle.tran_id)).status, 200);
});
