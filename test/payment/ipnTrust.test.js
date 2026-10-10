// The IPN URL is public, so nothing in an IPN body is trusted: it is fulfilled only when
// SSLCommerz confirms the transaction (tran_id query) AND its order record (val_id API)
// names the same user, item and item type that were sent at checkout.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, sign, pool } = require('../helpers/fixtures');
const sslcommerzStub = require('../helpers/sslcommerzStub');

const CHEAP = 781; // 500
const OTHER = 782; // 500, same price
const BUNDLE = 782; // 500, contains OTHER
let gw;

let nextUser = 781;
const newStudent = async () => {
    const id = nextUser++;
    await pool.query(
        `INSERT INTO managerial_auth (id, name, type, login, password, profile) VALUES ($1, 'Payer', 3, $2, 'x', '{}')`,
        [id, `0174000${id}`]
    );
    return { id, name: 'Payer', type: 3, login: `0174000${id}` };
};

before(async () => {
    await seed();
    await pool.query(`
        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free) VALUES
            (${CHEAP}, 'Cheap Course', 500, 500, true, true, 781, 'cheap-781', 'cheap-781', '[]', false),
            (${OTHER}, 'Other Course', 500, 500, true, true, 782, 'other-782', 'other-782', '[]', false);
        INSERT INTO bundle (id, title, price, is_live, is_active) VALUES (${BUNDLE}, 'Same Price Bundle', 500, true, true);
        INSERT INTO bundle_course (bundle_id, course_id) VALUES (${BUNDLE}, ${OTHER});
    `);
    gw = sslcommerzStub.install();
});

after(async () => {
    gw.restore();
    await pool.end();
});

const ipn = (fields) => request(app).post('/user/payment/ipn').type('form').send(fields);
const enrolments = async (userId) => (await pool.query(
    `SELECT course_id FROM takes WHERE user_id = $1 ORDER BY course_id`, [userId]
)).rows.map((r) => r.course_id);
const audit = async (where, param) => (await pool.query(
    `SELECT processing_status, error_message FROM payment_audit_log WHERE ${where} = $1 ORDER BY id`, [param]
)).rows;

// A real, paid checkout of CHEAP by `user`; returns the IPN SSLCommerz would send.
const paidCheckout = async (user) => {
    await request(app).post(`/user/payment/initiate/${CHEAP}`).set('Authorization', `Bearer ${sign(user, [], [])}`).send({});
    const init = gw.inits[gw.inits.length - 1];
    gw.setValidation(init.tran_id, { status: 'VALID', amount: '500.00', store_amount: '500.00', risk_level: '0' });
    return {
        status: 'VALID', tran_id: init.tran_id, val_id: `VAL-${init.tran_id}`, amount: '500.00',
        value_a: init.value_a, value_b: init.value_b, value_c: init.value_c, value_d: init.value_d,
    };
};

const MISMATCH = { success: false, error: 'IPN does not match the payment recorded by SSLCommerz' };

test('a VALID IPN without any transaction id is not fulfilled', async () => {
    const user = await newStudent();
    const res = await ipn({ status: 'VALID', value_a: user.id, value_b: OTHER, value_d: 'COURSE' });
    assert.deepStrictEqual(res.body, { success: false, error: 'Unverified IPN: no transaction ID to validate' });
    assert.deepStrictEqual(await enrolments(user.id), []);
    assert.deepStrictEqual(await audit('user_id', user.id), [
        { processing_status: 'ERROR', error_message: 'Unverified IPN: no transaction ID to validate' },
    ]);
});

test("a real payment's IPN cannot be re-pointed at another course, bundle or user", async () => {
    const buyer = await newStudent();
    const victim = await newStudent();
    const forgeries = [
        (ipnBody) => ({ ...ipnBody, value_b: String(OTHER) }),
        (ipnBody) => ({ ...ipnBody, value_b: String(BUNDLE), value_d: 'BUNDLE' }),
        (ipnBody) => ({ ...ipnBody, value_a: String(victim.id) }),
    ];
    for (const forge of forgeries) {
        const genuine = await paidCheckout(buyer);
        assert.deepStrictEqual((await ipn(forge(genuine))).body, MISMATCH);
        assert.deepStrictEqual(await audit('sslcommerz_tran_id', genuine.tran_id), [
            { processing_status: 'ERROR', error_message: MISMATCH.error },
        ]);
        // Checking the val_id marked the payment VALIDATED at SSLCommerz, so the genuine IPN
        // arriving after a forgery is answered as already processed (admin reconcile enrols it).
        assert.deepStrictEqual((await ipn(genuine)).body.already_processed, true);
    }
    assert.deepStrictEqual(await enrolments(buyer.id), []);
    assert.deepStrictEqual(await enrolments(victim.id), []);
    const bundles = await pool.query('SELECT 1 FROM bundle_purchase WHERE user_id = $1', [buyer.id]);
    assert.strictEqual(bundles.rowCount, 0);
});

test('the genuine IPN is fulfilled; without a val_id, or with one the gateway does not know, it is not', async () => {
    const user = await newStudent();
    const genuine = await paidCheckout(user);

    const withoutValId = { ...genuine };
    delete withoutValId.val_id;
    assert.deepStrictEqual((await ipn(withoutValId)).body, MISMATCH);
    assert.deepStrictEqual((await ipn({ ...genuine, val_id: 'NOT-A-VAL-ID' })).body, MISMATCH);
    assert.deepStrictEqual(await enrolments(user.id), []);

    assert.deepStrictEqual((await ipn(genuine)).body, { success: true, message: 'Course purchase processed successfully', risk_level: 0 });
    assert.deepStrictEqual(await enrolments(user.id), [CHEAP]);
    assert.ok(gw.orderCalls.includes(genuine.val_id));
});
