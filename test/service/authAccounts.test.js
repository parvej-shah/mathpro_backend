// AuthService.register / googleLogin / resetPasswordWithOTP (Frontend sign-up, "Continue with
// Google" and forgot password): every reply, the order of the checks, the stored account and the
// token. Pinned before the methods are split into smaller steps (REFACTOR_PLAN.md task 4.7).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const JWT = require('jsonwebtoken');
const { seed, pool } = require('../helpers/fixtures');
const { AuthService } = require('../../service/managerial/auth');

const auth = new AuthService();
const fail = (error) => ({ success: false, error });
const now = () => Math.floor(Date.now() / 1000);

// Accounts with fixed ids; the ones this file creates come from the sequence, moved out of
// the range other files use.
const TAKEN_PHONE = '01759000001';
const TAKEN_LOGIN = '01759000002';
const RESET_PHONE = '01759000010';
const RESET_ID = 961;
const GOOGLE_STUDENT = 962;
const GOOGLE_ADMIN = 963;

before(async () => {
    await seed();
    await pool.query(`SELECT setval('managerial_auth_id_seq', 30000)`);
    const hash = await bcrypt.hash('old-pass', 4);
    await pool.query(`
        INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile) VALUES
            (960, 'Taken', 3, '${TAKEN_LOGIN}', 'x', 'taken960@test.local', '${TAKEN_PHONE}', '{}'),
            (${RESET_ID}, 'Resetter', 3, '${RESET_PHONE}', '${hash}', NULL, '${RESET_PHONE}', '{}'),
            (${GOOGLE_STUDENT}, 'G Student', 3, 'gstudent962@test.local', 'x', 'gstudent962@test.local', '01759000962',
             '{"password_set": true, "auth_providers": ["password"], "keep": 1}'),
            (${GOOGLE_ADMIN}, 'G Admin', 1, 'gadmin963@test.local', 'x', 'gadmin963@test.local', NULL,
             '{"password_set": true, "auth_providers": ["password", "google"]}')
    `);
});

after(async () => {
    await pool.end();
});

const addOtp = (phone, otp = '123456', purpose = 'registration') => pool.query(
    `INSERT INTO otp (phone, purpose, otp, timestamp, expires_at, is_used, attempts) VALUES ($1, $2, $3, $4, $5, false, 0)`,
    [phone, purpose, otp, now(), now() + 600]
);
const otpState = async (phone) => (await pool.query(
    'SELECT is_used, attempts FROM otp WHERE phone = $1 ORDER BY id DESC LIMIT 1', [phone]
)).rows[0];
const account = async (id) => (await pool.query('SELECT * FROM managerial_auth WHERE id = $1', [id])).rows[0];
const sessions = async (userId) => (await pool.query(
    'SELECT session_id, user_agent, ip FROM auth_session WHERE user_id = $1 ORDER BY id', [userId]
)).rows;
const claims = (token) => {
    const { iat, exp, createdAt, ...rest } = JWT.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(exp - iat, 7 * 24 * 3600);
    assert.strictEqual(typeof createdAt, 'number');
    return rest;
};

// ---------- register ----------

test('register: input checks, in order', async () => {
    assert.deepStrictEqual(await auth.register({ login: 'someone@test.local', password: 'secret1', otp: '1' }),
        fail('Enter a valid phone number'));
    assert.deepStrictEqual(await auth.register({ login: '01759000100', password: ' 12345 ', otp: '1' }),
        fail('Password must be at least 6 characters long'));
    assert.deepStrictEqual(await auth.register({ login: '01759000100', password: 'secret1' }), fail('OTP is required'));
    // a bad phone is reported before a bad password
    assert.deepStrictEqual(await auth.register({ login: 'x', password: '1' }), fail('Enter a valid phone number'));
});

test('register: an existing phone or email is refused before the code is checked', async () => {
    await addOtp(TAKEN_PHONE);
    assert.deepStrictEqual(await auth.register({ login: TAKEN_PHONE, password: 'secret1', otp: '000000' }),
        fail('An account already exists with this phone'));
    assert.deepStrictEqual(await auth.register({ login: TAKEN_LOGIN, password: 'secret1', otp: '000000' }),
        fail('An account already exists with this phone'));
    assert.deepStrictEqual(await otpState(TAKEN_PHONE), { is_used: false, attempts: 0 });

    const fresh = '01759000101';
    await addOtp(fresh);
    assert.deepStrictEqual(
        await auth.register({ login: fresh, password: 'secret1', otp: '000000', email: ' Taken960@Test.Local ' }),
        fail('An account already exists with this email'));
    assert.deepStrictEqual(await otpState(fresh), { is_used: false, attempts: 0 });
});

test('register: a wrong or missing code is passed through', async () => {
    assert.deepStrictEqual(await auth.register({ login: '01759000102', password: 'secret1', otp: '123456' }),
        fail('No active code. Please request a new one.'));
    const phone = '01759000103';
    await addOtp(phone);
    assert.deepStrictEqual(await auth.register({ login: phone, password: 'secret1', otp: '654321' }), fail('Invalid OTP'));
    assert.deepStrictEqual(await otpState(phone), { is_used: false, attempts: 1 });
    const count = await pool.query('SELECT count(*)::int AS n FROM managerial_auth WHERE phone = $1', [phone]);
    assert.strictEqual(count.rows[0].n, 0);
});

test('register: creates the account, a session and a token', async () => {
    const phone = '01759000104';
    await addOtp(phone);
    const res = await auth.register(
        { name: '  Rafi  ', login: '+88 01759-000104', password: 'secret1', otp: '123456', email: ' New104@Test.Local ' },
        { userAgent: 'UA-register', ip: '10.0.0.1' }
    );
    assert.strictEqual(res.success, true, JSON.stringify(res));
    const id = res.user.id;
    assert.ok(id > 30000);
    assert.deepStrictEqual(res.user, { id, name: 'Rafi', type: 3, email: 'new104@test.local', phone });

    const stored = await account(id);
    assert.deepStrictEqual(
        [stored.name, stored.type, stored.login, stored.email, stored.phone, stored.profile],
        ['Rafi', 3, phone, 'new104@test.local', phone,
            { password_set: true, auth_providers: ['password'], phone_verified: true, email_verified: false }]
    );
    assert.strictEqual(await bcrypt.compare('secret1', stored.password), true);
    assert.deepStrictEqual(await otpState(phone), { is_used: true, attempts: 0 });

    const [session] = await sessions(id);
    assert.deepStrictEqual([session.user_agent, session.ip], ['UA-register', '10.0.0.1']);
    assert.deepStrictEqual(claims(res.token), {
        id, name: 'Rafi', type: 3, login: phone, profile: stored.profile, roles: [], permissions: [], sid: session.session_id,
    });
});

test('register: name and email default', async () => {
    const phone = '01759000105';
    await addOtp(phone);
    const res = await auth.register({ name: '   ', login: phone, password: 'secret1', otp: '123456', email: '  ' });
    assert.deepStrictEqual(res.user, { id: res.user.id, name: 'Student', type: 3, email: null, phone });
});

// ---------- googleLogin ----------

const asGoogle = (verification) => {
    auth.verifyGoogleToken = async () => verification;
};
const google = (email, name) => asGoogle({ success: true, data: { email, name } });

test('googleLogin: a failed verification is passed through', async () => {
    const real = new AuthService();
    assert.deepStrictEqual(await real.googleLogin({}), fail('Google id_token is required'));
    asGoogle(fail('Google token audience mismatch'));
    assert.deepStrictEqual(await auth.googleLogin({ id_token: 't' }), fail('Google token audience mismatch'));
});

test('googleLogin: an existing student gets google added, a session and a token', async () => {
    google('gstudent962@test.local', 'Ignored Name');
    const res = await auth.googleLogin({ id_token: 't' }, { userAgent: 'UA-google', ip: '10.0.0.2' });
    assert.strictEqual(res.success, true, JSON.stringify(res));
    assert.deepStrictEqual(res.user, {
        id: GOOGLE_STUDENT, name: 'G Student', type: 3, email: 'gstudent962@test.local', phone: '01759000962', roles: [], permissions: [],
    });
    const stored = await account(GOOGLE_STUDENT);
    assert.deepStrictEqual(stored.profile, { password_set: true, auth_providers: ['password', 'google'], keep: 1 });
    const [session] = await sessions(GOOGLE_STUDENT);
    assert.deepStrictEqual([session.user_agent, session.ip], ['UA-google', '10.0.0.2']);
    assert.deepStrictEqual(claims(res.token), {
        id: GOOGLE_STUDENT, name: 'G Student', type: 3, login: 'gstudent962@test.local', profile: stored.profile,
        roles: [], permissions: [], sid: session.session_id,
    });
});

test('googleLogin: an admin keeps a session-less token and an unchanged profile is not rewritten', async () => {
    const before = (await account(GOOGLE_ADMIN)).updated_at;
    google('gadmin963@test.local', 'x');
    const res = await auth.googleLogin({ id_token: 't' });
    assert.strictEqual(res.success, true, JSON.stringify(res));
    assert.deepStrictEqual(res.user, {
        id: GOOGLE_ADMIN, name: 'G Admin', type: 1, email: 'gadmin963@test.local', phone: null, roles: [], permissions: [],
    });
    assert.strictEqual('sid' in claims(res.token), false);
    assert.deepStrictEqual(await sessions(GOOGLE_ADMIN), []);
    assert.deepStrictEqual((await account(GOOGLE_ADMIN)).updated_at, before);
});

test('googleLogin: an account is also found by its login', async () => {
    await pool.query(`INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile)
                      VALUES (964, 'By Login', 3, 'bylogin964@test.local', 'x', NULL, NULL, NULL)`);
    google('bylogin964@test.local', 'x');
    const res = await auth.googleLogin({ id_token: 't' });
    assert.strictEqual(res.user.id, 964);
    // a NULL profile with a stored password becomes password_set: true + google
    assert.deepStrictEqual((await account(964)).profile, { password_set: true, auth_providers: ['google'] });
});

test('googleLogin: a new email creates a regular account', async () => {
    google('newgoogle@test.local', 'New Googler');
    const res = await auth.googleLogin({ id_token: 't' }, { userAgent: 'UA-new' });
    assert.strictEqual(res.success, true, JSON.stringify(res));
    const id = res.user.id;
    assert.ok(id > 30000);
    assert.deepStrictEqual(res.user, {
        id, name: 'New Googler', type: 3, email: 'newgoogle@test.local', phone: null, roles: [], permissions: [],
    });
    const stored = await account(id);
    assert.deepStrictEqual([stored.login, stored.email, stored.phone, stored.profile], [
        'newgoogle@test.local', 'newgoogle@test.local', null,
        { password_set: false, auth_providers: ['google'], email_verified: true, phone_verified: false },
    ]);
    assert.match(stored.password, /^\$2[aby]\$10\$/);
    const [session] = await sessions(id);
    assert.strictEqual(session.user_agent, 'UA-new');
    assert.deepStrictEqual(claims(res.token), {
        id, name: 'New Googler', type: 3, login: 'newgoogle@test.local', profile: stored.profile,
        roles: [], permissions: [], sid: session.session_id,
    });
});

// ---------- resetPasswordWithOTP ----------

test('resetPasswordWithOTP: input checks, then the code', async () => {
    assert.deepStrictEqual(await auth.resetPasswordWithOTP('someone@test.local', '1', 'secret1'), fail('Enter a valid phone number'));
    assert.deepStrictEqual(await auth.resetPasswordWithOTP(RESET_PHONE, '1', 'short'), fail('Password must be at least 6 characters long'));
    assert.deepStrictEqual(await auth.resetPasswordWithOTP(RESET_PHONE, '1', undefined), fail('Password must be at least 6 characters long'));
    await addOtp(RESET_PHONE, '222222', 'password_reset');
    assert.deepStrictEqual(await auth.resetPasswordWithOTP(RESET_PHONE, '999999', 'secret1'), fail('Invalid OTP'));
    assert.strictEqual(await bcrypt.compare('old-pass', (await account(RESET_ID)).password), true);
});

test('resetPasswordWithOTP: sets the password and logs out every device', async () => {
    await auth.createSession(RESET_ID, { userAgent: 'a' });
    await auth.createSession(RESET_ID, { userAgent: 'b' });
    const res = await auth.resetPasswordWithOTP(`+88${RESET_PHONE}`, '222222', 'brand-new');
    assert.deepStrictEqual(res, { success: true, message: 'Password updated successfully' });
    assert.strictEqual(await bcrypt.compare('brand-new', (await account(RESET_ID)).password), true);
    assert.deepStrictEqual(await sessions(RESET_ID), []);
    assert.deepStrictEqual(await otpState(RESET_PHONE), { is_used: true, attempts: 1 });
});

test('resetPasswordWithOTP: a valid code for a phone with no account', async () => {
    await addOtp('01759000199', '333333', 'password_reset');
    assert.deepStrictEqual(await auth.resetPasswordWithOTP('01759000199', '333333', 'secret1'),
        fail('Failed to update password - user not found'));
});
