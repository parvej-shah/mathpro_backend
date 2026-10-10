// AdminService.update (Admin app: edit an admin/moderator): the order of the checks and every
// reply. Pinned before the method is split into smaller steps (REFACTOR_PLAN.md task 4.7).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const { seed, pool } = require('../helpers/fixtures');
const { AdminService } = require('../../service/managerial/admin');

const admins = new AdminService();
const UPDATER = 891;
const TARGET = 892;
const OTHER = 893;

before(async () => {
    await seed();
    const hash = await bcrypt.hash('updater-pass', 4);
    await pool.query(`
        INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile) VALUES
            (${UPDATER}, 'Updater', 1, 'updater891@test.local', '${hash}', 'updater891@test.local', NULL, '{}'),
            (${TARGET}, 'Target', 2, 'target892@test.local', 'x', 'target892@test.local', '01711000892', '{"a":1}'),
            (${OTHER}, 'Other', 2, 'other893@test.local', 'x', 'other893@test.local', '01711000893', '{}');
    `);
});

after(async () => {
    await pool.end();
});

const fail = (error) => ({ success: false, error });
const row = async () => (await pool.query(
    'SELECT name, type, login, email, phone, profile, password FROM managerial_auth WHERE id = $1', [TARGET]
)).rows[0];

test('unknown admin, and nothing to update', async () => {
    assert.strictEqual((await admins.update(99999, { name: 'x' }, UPDATER)).success, false);
    assert.deepStrictEqual(await admins.update(TARGET, {}, UPDATER), fail('No fields to update'));
});

test('email / password changes need the updater\'s current password', async () => {
    const needed = fail('Current password is required to update email or password');
    assert.deepStrictEqual(await admins.update(TARGET, { email: 'new892@test.local' }, UPDATER), needed);
    assert.deepStrictEqual(await admins.update(TARGET, { password: 'newpass1' }, UPDATER), needed);
    assert.deepStrictEqual(
        await admins.update(TARGET, { password: 'newpass1', currentPassword: 'wrong' }, UPDATER), fail('Current password is incorrect'));
    assert.deepStrictEqual(
        await admins.update(TARGET, { password: 'newpass1', currentPassword: 'x' }, 99999), fail('Updater not found'));
    // an unchanged email is not a change
    assert.strictEqual((await admins.update(TARGET, { email: 'target892@test.local', name: 'Target' }, UPDATER)).success, true);
});

test('field validation replies, in field order', async () => {
    assert.deepStrictEqual(await admins.update(TARGET, { type: 3 }, UPDATER), fail('Type must be 1 (Admin) or 2 (Moderator)'));
    assert.deepStrictEqual(
        await admins.update(TARGET, { email: 'not-an-email', currentPassword: 'updater-pass' }, UPDATER), fail('Invalid email format'));
    assert.deepStrictEqual(
        await admins.update(TARGET, { email: 'other893@test.local', currentPassword: 'updater-pass' }, UPDATER), fail('Email already exists'));
    assert.deepStrictEqual(
        await admins.update(TARGET, { phone: '123' }, UPDATER), fail('Invalid phone number. Must be 11 digits starting with 01'));
    assert.deepStrictEqual(await admins.update(TARGET, { phone: '01711000893' }, UPDATER), fail('Phone number already exists'));
    // a bad type is reported before a bad phone
    assert.deepStrictEqual(await admins.update(TARGET, { type: 9, phone: '123' }, UPDATER), fail('Type must be 1 (Admin) or 2 (Moderator)'));
});

test('a valid update writes only the given fields and returns the row', async () => {
    const res = await admins.update(TARGET, {
        name: 'Renamed', type: 1, phone: '01711000899', profile: '{"b":2}',
        email: 'New892@Test.Local', password: 'newpass1', currentPassword: 'updater-pass',
    }, UPDATER);
    assert.strictEqual(res.success, true, JSON.stringify(res));
    assert.strictEqual(res.message, 'Admin updated successfully');
    assert.deepStrictEqual(Object.keys(res.data).sort(), ['created_at', 'email', 'id', 'login', 'name', 'phone', 'profile', 'type', 'updated_at']);
    const stored = await row();
    assert.deepStrictEqual(
        [stored.name, stored.type, stored.login, stored.email, stored.phone, stored.profile],
        ['Renamed', 1, 'new892@test.local', 'new892@test.local', '01711000899', { b: 2 }]
    );
    assert.strictEqual(await bcrypt.compare('newpass1', stored.password), true);
});

test('an empty phone clears it', async () => {
    assert.strictEqual((await admins.update(TARGET, { phone: '' }, UPDATER)).success, true);
    assert.strictEqual((await row()).phone, null);
});
