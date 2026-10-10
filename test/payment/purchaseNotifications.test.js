// What a successful IPN sends: SMS + email recipients, SMS text, email subject (the HTML body
// is compared byte-for-byte by the template move itself), and the COURSE_PERCHASE log row.
// MessagingService is replaced before the app loads, so every instance records instead of sending.
const { test, before, after } = require('node:test');
const assert = require('node:assert');

const sent = [];
const messaging = require('../../service/messagingService.js');
const RealMessagingService = messaging.MessagingService;
messaging.MessagingService = class RecordingMessagingService extends RealMessagingService {
    constructor() {
        super();
        this.sendMessage = async (phone, text) => {
            sent.push({ kind: 'sms', to: phone, text });
            return { success: true };
        };
        this.sendMail = async (email, subject, html) => {
            sent.push({ kind: 'mail', to: email, subject, html });
            return { success: true };
        };
    }
};

const request = require('supertest');
const app = require('../../app');
const { seed, sign, pool } = require('../helpers/fixtures');
const sslcommerzStub = require('../helpers/sslcommerzStub');

const COURSE = 741;
const BUNDLE = 741;
const FRONTEND = process.env.FRONTEND_URL;
let gw;

before(async () => {
    await seed();
    await pool.query(`
        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free) VALUES
            (${COURSE}, 'Notified Course', 800, 900, true, true, 741, 'notified-course', 'notified-course', '[]', false),
            (742, 'Bundled Course', 500, 600, true, true, 742, 'bundled-course', 'bundled-course', '[]', false);
        INSERT INTO bundle (id, title, price, is_live, is_active) VALUES (${BUNDLE}, 'Notified Bundle', 1200, true, true);
        INSERT INTO bundle_course (bundle_id, course_id) VALUES (${BUNDLE}, 742);
        INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile) VALUES
            (741, 'Mail Only', 3, '01730000741', 'x', 'col741@test.local', NULL, '{"email": "profile741@test.local"}'),
            (742, 'Bundle Buyer', 3, '01730000742', 'x', 'b742@test.local', NULL, '{}');
    `);
    gw = sslcommerzStub.install();
});

after(async () => {
    gw.restore();
    messaging.MessagingService = RealMessagingService;
    await pool.end();
});

const buy = async (userId, path, price) => {
    const user = { id: userId, name: 'x', type: 3, login: `0173000${userId}` };
    await request(app).post(`/user/payment/${path}`).set('Authorization', `Bearer ${sign(user, [], [])}`).send({});
    const init = gw.inits[gw.inits.length - 1];
    gw.setValidation(init.tran_id, { status: 'VALID', val_id: 'V', amount: String(price), store_amount: String(price), risk_level: '0' });
    sent.length = 0;
    const res = await request(app).post('/user/payment/ipn').type('form').send({
        status: 'VALID', tran_id: init.tran_id, val_id: 'V', amount: String(price),
        value_a: init.value_a, value_b: init.value_b, value_c: init.value_c, value_d: init.value_d,
    });
    assert.strictEqual(res.body.success, true, JSON.stringify(res.body));
    await new Promise((resolve) => setTimeout(resolve, 50)); // sending is not awaited by the IPN
    return init.tran_id;
};

const purchaseLog = async (userId) => (await pool.query(
    `SELECT data FROM log WHERE name = 'COURSE_PERCHASE' AND (data->>'user_id')::int = $1`, [userId]
)).rows.map((r) => r.data);

test('course purchase: SMS to the login, mail to the profile email, purchase log', async () => {
    const tranId = await buy(741, `initiate/${COURSE}`, 800);
    assert.deepStrictEqual(sent.map(({ kind, to, text, subject }) => ({ kind, to, text, subject })), [
        {
            kind: 'sms', to: '01730000741', subject: undefined,
            text: `Dear Mail Only, you have successfully purchased "Notified Course" course from Math Pro. Your access code is: ${tranId}. Start learning: ${FRONTEND}/dashboard/${COURSE}`,
        },
        { kind: 'mail', to: 'profile741@test.local', text: undefined, subject: 'Course Purchased Confirmation | Math Pro' },
    ]);
    const html = sent[1].html;
    assert.ok(html.includes(`<strong>Notified Course</strong>`) && html.includes(`${FRONTEND}/billing/invoice/${tranId}`), html);
    // The IPN's own `amount` field (a string) is what gets logged for a course.
    assert.deepStrictEqual(await purchaseLog(741), [{ user_id: 741, course_id: COURSE, amount: '800' }]);
});

test('bundle purchase: course count in the SMS, course list in the mail, bundle log', async () => {
    const tranId = await buy(742, `initiate-for-bundle/${BUNDLE}`, 1200);
    assert.deepStrictEqual(sent.map(({ kind, to, text, subject }) => ({ kind, to, text, subject })), [
        {
            kind: 'sms', to: '01730000742', subject: undefined,
            text: `Dear Bundle Buyer, you have successfully purchased the "Notified Bundle" bundle from Math Pro! You are now enrolled in 1 courses. Your access code is: ${tranId}. View dashboard: ${FRONTEND}/dashboard`,
        },
        { kind: 'mail', to: 'b742@test.local', text: undefined, subject: 'Bundle Purchase Confirmation | Math Pro' },
    ]);
    assert.ok(sent[1].html.includes('<li>Bundled Course</li>'), sent[1].html);
    assert.deepStrictEqual(await purchaseLog(742), [{ user_id: 742, course_id: BUNDLE, amount: 1200, type: 'bundle' }]);
});
