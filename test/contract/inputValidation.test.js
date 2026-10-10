// The 400 replies for missing/invalid input on the auth (Frontend + Admin login flows) and
// student coupon endpoints. Each identifier-limited call uses its own login/contact so the
// rate limiter (keyed by identifier + IP) never interferes.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, studentToken, pool } = require('../helpers/fixtures');

before(seed);

after(async () => {
    await pool.end();
});

let n = 0;
const uniq = () => `v${Date.now()}${++n}@test.local`;
const bad = (error) => ({ status: 400, body: { success: false, error } });
const call = async (method, path, body, token) => {
    const req = request(app)[method](path);
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req.send(body);
    return { status: res.status, body: res.body };
};

test('auth: each endpoint names the fields it requires', async () => {
    const cases = [
        ['/admin/auth/request-otp', {}, 'Phone number or email is required'],
        ['/admin/auth/forgot-password', {}, 'Phone number or email is required'],
        ['/admin/auth/verify-otp', { otp: '1' }, 'Contact and OTP are required'],
        ['/admin/auth/verify-otp', { contact: uniq() }, 'Contact and OTP are required'],
        ['/admin/auth/register', { login: uniq(), password: 'p' }, 'Login, password and OTP are required'],
        ['/admin/auth/register', { login: uniq(), otp: '1' }, 'Login, password and OTP are required'],
        ['/admin/auth/login', { login: uniq() }, 'Login and password are required'],
        ['/admin/auth/login', { password: 'p', email: uniq() }, 'Login and password are required'],
        ['/admin/auth/google', {}, 'Google id_token is required'],
        ['/admin/auth/reset-password', { contact: uniq(), otp: '1' }, 'Contact, OTP, and new password are required'],
        ['/admin/auth/reset-password', { otp: '1', newPassword: 'x' }, 'Contact, OTP, and new password are required'],
    ];
    for (const [path, body, error] of cases) {
        assert.deepStrictEqual(await call('post', path, body), bad(error), `${path} ${JSON.stringify(body)}`);
    }
});

test('auth: an empty string counts as missing; complete input reaches the service', async () => {
    assert.deepStrictEqual(await call('post', '/admin/auth/login', { login: uniq(), password: '' }), bad('Login and password are required'));
    const res = await call('post', '/admin/auth/login', { login: uniq(), password: 'wrong' });
    assert.notDeepStrictEqual(res.body, { success: false, error: 'Login and password are required' });
});

test('auth (logged in): link-phone and connect-google required fields', async () => {
    assert.deepStrictEqual(
        await call('post', '/admin/auth/link-phone', { phone: '0170', password: 'p' }, studentToken()),
        bad('Phone, password and OTP are required')
    );
    assert.deepStrictEqual(await call('post', '/admin/auth/connect-google', {}, studentToken()), bad('Google id_token is required'));
});

for (const action of ['validate', 'apply']) {
    test(`coupon ${action}: code, exactly one target, numeric id`, async () => {
        const path = `/user/coupon/${action}`;
        const cases = [
            [{ course_id: 1 }, 'Coupon code is required'],
            [{ coupon_code: 'X' }, 'Either course_id, bundle_id or book_id is required'],
            [{ coupon_code: 'X', course_id: 1, bundle_id: 1 }, 'Provide only one of course_id, bundle_id or book_id'],
            [{ coupon_code: 'X', bundle_id: 1, book_id: 1 }, 'Provide only one of course_id, bundle_id or book_id'],
            [{ coupon_code: 'X', course_id: 'abc' }, 'Valid course ID is required'],
            [{ coupon_code: 'X', bundle_id: 'abc' }, 'Valid bundle ID is required'],
            [{ coupon_code: 'X', book_id: 'abc' }, 'Valid book ID is required'],
        ];
        for (const [body, error] of cases) {
            assert.deepStrictEqual(await call('post', path, body), bad(error), JSON.stringify(body));
        }
        // A well-formed request for an unknown code reaches the coupon service.
        const unknown = await call('post', path, { coupon_code: 'NO-SUCH-CODE', course_id: 1 });
        assert.strictEqual(unknown.status, 400);
        assert.strictEqual(unknown.body.success === false || unknown.body.valid === false, true);
        assert.notStrictEqual(unknown.body.error, 'Valid course ID is required');
    });
}

test('coupon validate/apply happy paths: course and bundle, with click tracking on apply', async () => {
    const t = Math.floor(Date.now() / 1000);
    await pool.query(
        `INSERT INTO coupons (id, name, code, discount_type, discount_value, start_time, end_time, created_at, updated_at, status)
         VALUES (841, 'IV', 'IVCOURSE', 'fixed', 100, $1, $2, $1, $1, 'active'),
                (842, 'IV2', 'IVBUNDLE', 'percentage', 10, $1, $2, $1, $1, 'active')`,
        [t - 60, t + 3600]
    );
    await pool.query('INSERT INTO coupon_courses (coupon_id, course_id, created_at) VALUES (841, 1, $1)', [t]);
    await pool.query('INSERT INTO coupon_bundles (coupon_id, bundle_id, created_at) VALUES (842, 1, $1)', [t]);

    const v1 = await call('post', '/user/coupon/validate', { coupon_code: 'IVCOURSE', course_id: '1' }, studentToken());
    assert.strictEqual(v1.status, 200, JSON.stringify(v1.body));
    assert.strictEqual(v1.body.valid, true);
    const v2 = await call('post', '/user/coupon/validate', { coupon_code: 'IVBUNDLE', bundle_id: 1 }, studentToken());
    assert.strictEqual(v2.body.valid, true, JSON.stringify(v2.body));

    const a1 = await call('post', '/user/coupon/apply', { coupon_code: 'IVCOURSE', course_id: 1 }, studentToken());
    assert.strictEqual(a1.status, 200, JSON.stringify(a1.body));
    assert.deepStrictEqual(
        [a1.body.data.original_price, a1.body.data.discount_amount, a1.body.data.final_price],
        [1000, 100, 900]
    );
    const a2 = await call('post', '/user/coupon/apply', { coupon_code: 'IVBUNDLE', bundle_id: '1' }, studentToken());
    assert.deepStrictEqual([a2.body.data.original_price, a2.body.data.final_price], [900, 810]);

    const clicks = (await pool.query(
        'SELECT coupon_id, user_id, course_id, bundle_id FROM coupon_clicks WHERE coupon_id IN (841, 842) ORDER BY coupon_id'
    )).rows;
    assert.deepStrictEqual(clicks, [
        { coupon_id: 841, user_id: 2, course_id: 1, bundle_id: null },
        { coupon_id: 842, user_id: 2, course_id: null, bundle_id: 1 },
    ]);
});
