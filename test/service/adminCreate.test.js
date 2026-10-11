// AdminService.create (Admin app: add an admin/moderator): the order of the checks, every
// reply, the stored row and the credentials SMS. Pinned before the method is split into smaller
// steps (REFACTOR_PLAN.md task 4.7).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

const sms = [];
let smsFails = false;
const messaging = require('../../service/messagingService.js');
const RealMessagingService = messaging.MessagingService;
messaging.MessagingService = class RecordingMessagingService extends RealMessagingService {
    constructor() {
        super();
        this.sendMessage = async (phone, text) => {
            sms.push({ phone, text });
            return smsFails ? { success: false, error: 'gateway down' } : { success: true };
        };
    }
};

const { seed, pool } = require('../helpers/fixtures');
const { AdminService } = require('../../service/managerial/admin');

const admins = new AdminService();
const fail = (error) => ({ success: false, error });

before(async () => {
    await seed();
    await pool.query(`SELECT setval('managerial_auth_id_seq', 31000)`);
    await pool.query(`
        INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile) VALUES
            (971, 'By Phone', 2, 'byphone971@test.local', 'x', 'byphone971@test.local', '01758000971', '{}'),
            (972, 'By Login', 3, '01758000972', 'x', 'login972@test.local', NULL, '{}'),
            (973, 'Email Login', 2, 'emaillogin973@test.local', 'x', NULL, NULL, '{}')
    `);
});

after(async () => {
    messaging.MessagingService = RealMessagingService;
    await pool.end();
});

test('required fields and type', async () => {
    const required = fail('Name, type, and phone are required');
    assert.deepStrictEqual(await admins.create({ type: 1, phone: '01758000100' }), required);
    assert.deepStrictEqual(await admins.create({ name: 'A', phone: '01758000100' }), required);
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 1 }), required);
    const badType = fail('Type must be 1 (Admin) or 2 (Moderator)');
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 3, phone: '01758000100' }), badType);
    assert.deepStrictEqual(await admins.create({ name: 'A', type: '1', phone: '01758000100' }), badType);
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 9, phone: 'bad' }), badType);
});

test('formats are checked before the database', async () => {
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 1, phone: '123' }),
        fail('Invalid phone number. Must be 11 digits starting with 01'));
    // a taken phone with a bad email reports the email format first
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 1, phone: '01758000971', email: 'nope' }),
        fail('Invalid email format'));
});

test('a phone or email already in use', async () => {
    const phoneTaken = fail('Phone number already exists');
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 2, phone: ' 01758000971 ' }), phoneTaken);
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 2, phone: '01758000972' }), phoneTaken);
    // phone is checked before email
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 2, phone: '01758000971', email: 'byphone971@test.local' }), phoneTaken);
    const emailTaken = fail('Email already exists');
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 2, phone: '01758000101', email: 'Login972@Test.Local' }), emailTaken);
    assert.deepStrictEqual(await admins.create({ name: 'A', type: 2, phone: '01758000101', email: 'emaillogin973@test.local' }), emailTaken);
    assert.strictEqual(sms.length, 0);
});

test('creates the admin and texts the credentials', async () => {
    sms.length = 0;
    const res = await admins.create({ name: 'New Mod', type: 2, phone: ' 01758000102 ', email: ' NewMod@Test.Local ', profile: { team: 'x' } });
    assert.strictEqual(res.success, true, JSON.stringify(res));
    assert.strictEqual(res.message, 'Admin created successfully. Credentials have been sent via SMS.');
    assert.deepStrictEqual(Object.keys(res).sort(), ['data', 'message', 'success']);
    const { id, created_at, ...data } = res.data;
    assert.ok(id > 31000 && created_at);
    assert.deepStrictEqual(data, {
        name: 'New Mod', type: 2, login: '01758000102', email: 'newmod@test.local', phone: '01758000102', profile: { team: 'x' },
    });

    assert.strictEqual(sms.length, 1);
    assert.strictEqual(sms[0].phone, '01758000102');
    const match = sms[0].text.match(/^Math Pro Admin\nName: New Mod\nLogin: 01758000102\nPassword: ([A-Za-z0-9]{8})\nLogin at: (.+)\/$/);
    assert.ok(match, sms[0].text);
    assert.strictEqual(match[2], process.env.ADMIN_URL || 'https://admin.mathprobd.com');
    const stored = (await pool.query('SELECT password FROM managerial_auth WHERE id = $1', [id])).rows[0];
    assert.strictEqual(await bcrypt.compare(match[1], stored.password), true);
});

test('without email or profile', async () => {
    const res = await admins.create({ name: 'Plain', type: 1, phone: '01758000103' });
    assert.strictEqual(res.success, true, JSON.stringify(res));
    assert.deepStrictEqual([res.data.email, res.data.profile, res.data.type], [null, {}, 1]);
});

test('a failed SMS still creates the admin and returns the password', async () => {
    smsFails = true;
    try {
        const res = await admins.create({ name: 'No Sms', type: 1, phone: '01758000104' });
        assert.deepStrictEqual(Object.keys(res).sort(), ['data', 'message', 'password', 'smsFailed', 'success']);
        assert.deepStrictEqual([res.success, res.smsFailed, res.message],
            [true, true, 'Admin created but SMS delivery failed. Please share the password manually.']);
        assert.match(res.password, /^[A-Za-z0-9]{8}$/);
        const stored = (await pool.query('SELECT password FROM managerial_auth WHERE id = $1', [res.data.id])).rows[0];
        assert.strictEqual(await bcrypt.compare(res.password, stored.password), true);
    } finally {
        smsFails = false;
    }
});
