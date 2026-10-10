// Admin feedback endpoints that take an optional ?courseId filter: a non-numeric id is a 400,
// and a course the caller can't manage (by their roles in the DB, not the token) is a 403.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { STUDENT, seed, sign, pool } = require('../helpers/fixtures');
const { PERMISSIONS } = require('../../util/permissions');

// A manager whose DB role grants feedback.manage.all.
const MANAGER = { id: 811, name: 'Feedback Manager', type: 1, login: 'fm@test.local' };

before(async () => {
    await seed();
    await pool.query(`INSERT INTO managerial_auth (id, name, type, login, password, email, profile)
                      VALUES (811, 'Feedback Manager', 1, 'fm@test.local', 'x', 'fm@test.local', '{}')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, permissions)
                      VALUES (811, 'feedback_manager_test', 'Feedback Manager', $1)`,
    [JSON.stringify([PERMISSIONS.FEEDBACK.MANAGE.ALL])]);
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES (811, 811)');
});

after(async () => {
    await pool.end();
});

const managerToken = () => sign(MANAGER, [], [PERMISSIONS.FEEDBACK.MANAGE.ALL]);
// Passes the route's JWT guard, but the user has no role in the DB.
const staleToken = () => sign(STUDENT, [], [PERMISSIONS.FEEDBACK.MANAGE.ALL]);

const endpoints = ['/admin/feedback/stats', '/admin/feedback/export', '/admin/module-feedback', '/admin/module-feedback/export'];

for (const path of endpoints) {
    test(`${path}: ?courseId filter is validated and access-checked`, async () => {
        const invalid = await request(app).get(`${path}?courseId=abc`).set('Authorization', `Bearer ${managerToken()}`);
        assert.strictEqual(invalid.status, 400);
        assert.deepStrictEqual(invalid.body, { success: false, error: 'Invalid course ID' });

        const denied = await request(app).get(`${path}?courseId=1`).set('Authorization', `Bearer ${staleToken()}`);
        assert.strictEqual(denied.status, 403);
        assert.deepStrictEqual(denied.body, { success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' });

        const allowed = await request(app).get(`${path}?courseId=1`).set('Authorization', `Bearer ${managerToken()}`);
        assert.strictEqual(allowed.status, 200);
    });
}

test('module-feedback stats and course report: 403 for a course the caller cannot manage', async () => {
    await pool.query(`INSERT INTO module (id, chapter_id, title, serial, is_live, is_free, data, metadata)
                      VALUES (2, 1, 'Module 2', 2, true, true, '{}', '{}') ON CONFLICT (id) DO NOTHING`);
    for (const path of ['/admin/module-feedback/stats/2', '/admin/module-feedback/course/1/report']) {
        const denied = await request(app).get(path).set('Authorization', `Bearer ${staleToken()}`);
        assert.strictEqual(denied.status, 403, path);
        assert.deepStrictEqual(denied.body, { success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' });
    }
    const missing = await request(app).get('/admin/module-feedback/stats/999999').set('Authorization', `Bearer ${managerToken()}`);
    assert.strictEqual(missing.status, 404);
    assert.deepStrictEqual(missing.body, { success: false, error: 'Module not found' });
});
