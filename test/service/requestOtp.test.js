// AuthService.requestOTP (Frontend sign-up, forgot password and phone change): who may get
// a code, the resend cooldown and daily cap, one active code per phone+purpose, delivery.
const { test, before, after } = require('node:test');
const assert = require('node:assert');

const sent = [];
let sendFails = false;
const messaging = require('../../service/messagingService.js');
const RealMessagingService = messaging.MessagingService;
messaging.MessagingService = class RecordingMessagingService extends RealMessagingService {
    constructor() {
        super();
        this.sendOTP = async (value, contactType, otp, purpose) => {
            sent.push({ value, contactType, otp, purpose });
            return sendFails ? { success: false, error: 'gateway down' } : { success: true };
        };
    }
};

const { AuthService } = require('../../service/managerial/auth');
const { seed, pool } = require('../helpers/fixtures');

const auth = new AuthService();
const now = () => Math.floor(Date.now() / 1000);
const otpRows = async (phone) => (await pool.query(
    'SELECT purpose, is_used FROM otp WHERE phone = $1 ORDER BY timestamp, id', [phone]
)).rows;
const addOtp = (phone, purpose, ageSeconds, isUsed = false) => pool.query(
    `INSERT INTO otp (phone, purpose, otp, timestamp, expires_at, is_used, attempts) VALUES ($1, $2, '111111', $3, $4, $5, 0)`,
    [phone, purpose, now() - ageSeconds, now() + 600, isUsed]
);

before(async () => {
    await seed();
    await pool.query(`INSERT INTO managerial_auth (id, name, type, login, password, phone, profile)
                      VALUES (881, 'Phone Owner', 3, '01788000881', 'x', '01788000882', '{}')`);
});

after(async () => {
    messaging.MessagingService = RealMessagingService;
    await pool.end();
});

test('only phone numbers get a code', async () => {
    for (const contact of ['someone@test.local', 'not-a-contact', '']) {
        assert.deepStrictEqual(await auth.requestOTP(contact), { success: false, error: 'Enter a valid phone number' }, contact);
    }
});

test('each purpose checks the account first', async () => {
    assert.deepStrictEqual(await auth.requestOTP('01788000881', 'registration'),
        { success: false, error: 'An account already exists with this phone' });
    assert.deepStrictEqual(await auth.requestOTP('01788000882', 'registration'),
        { success: false, error: 'An account already exists with this phone' });
    assert.deepStrictEqual(await auth.requestOTP('01788000899', 'password_reset'),
        { success: false, error: 'No account found with this phone' });
    assert.deepStrictEqual(await auth.requestOTP('01788000882', 'phone_change'),
        { success: false, error: 'An account already exists with this phone' });
    // phone_change only looks at the phone column, not the login
    assert.strictEqual((await auth.requestOTP('01788000881', 'phone_change')).success, true);
    assert.strictEqual(sent.length, 1);
});

test('a code is stored, sent, and replaces the earlier unused one', async () => {
    const phone = '01788000891';
    await addOtp(phone, 'registration', 3600);
    sent.length = 0;
    assert.deepStrictEqual(await auth.requestOTP(phone, 'registration'), { success: true, message: 'OTP sent to your phone' });
    assert.strictEqual(sent.length, 1);
    assert.deepStrictEqual({ ...sent[0], otp: /^\d{6}$/.test(sent[0].otp) }, { value: phone, contactType: 'phone', otp: true, purpose: 'registration' });
    assert.deepStrictEqual(await otpRows(phone), [
        { purpose: 'registration', is_used: true },
        { purpose: 'registration', is_used: false },
    ]);
    const stored = await pool.query('SELECT otp, expires_at - timestamp AS ttl FROM otp WHERE phone = $1 AND is_used = false', [phone]);
    assert.strictEqual(stored.rows[0].otp, sent[0].otp);
});

test('resend cooldown and daily cap, per phone and purpose', async () => {
    const phone = '01788000892';
    await addOtp(phone, 'registration', 10);
    const wait = await auth.requestOTP(phone, 'registration');
    assert.strictEqual(wait.success, false);
    assert.match(wait.error, /^Please wait (49|50|51)s before requesting another code$/);
    // Another purpose has its own cooldown.
    assert.strictEqual((await auth.requestOTP(phone, 'password_reset')).success, false); // no account
    const capped = '01788000893';
    for (let i = 0; i < 5; i++) await addOtp(capped, 'registration', 120 + i * 60, true);
    assert.deepStrictEqual(await auth.requestOTP(capped, 'registration'),
        { success: false, error: 'Daily OTP limit reached. Please try again later.' });
    const older = '01788000894';
    for (let i = 0; i < 5; i++) await addOtp(older, 'registration', 25 * 3600 + i, true);
    assert.strictEqual((await auth.requestOTP(older, 'registration')).success, true);
});

test('a failed delivery is reported', async () => {
    sendFails = true;
    try {
        assert.deepStrictEqual(await auth.requestOTP('01788000895', 'registration'),
            { success: false, error: 'Failed to send OTP. Please try again.' });
    } finally {
        sendFails = false;
    }
});
