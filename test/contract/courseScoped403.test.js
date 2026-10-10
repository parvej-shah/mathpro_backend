// Admin routine + announcement endpoints: the 403 NO_COURSE_ACCESS replies. The route's JWT
// guard passes; the controller re-checks the caller's DB roles per course / per resource.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { STUDENT, seed, sign, pool } = require('../helpers/fixtures');
const { PERMISSIONS } = require('../../util/permissions');

before(seed);

after(async () => {
    await pool.end();
});

const NO_ACCESS = { success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' };

const cases = [
    ['routine', PERMISSIONS.ROUTINE.MANAGE.ALL, 'Routine not found', [
        ['get', '/admin/routine/course/1'],
        ['post', '/admin/routine/create/1'],
    ], [
        ['get', '/admin/routine/get/999999'],
        ['put', '/admin/routine/update/999999'],
        ['delete', '/admin/routine/delete/999999'],
        ['patch', '/admin/routine/toggle-active/999999'],
    ]],
    ['announcement', PERMISSIONS.ANNOUNCEMENT.MANAGE.ALL, 'Announcement not found', [
        ['get', '/admin/announcement/list/1'],
        ['post', '/admin/announcement/create/1'],
    ], [
        ['get', '/admin/announcement/get/999999'],
        ['put', '/admin/announcement/update/999999'],
        ['delete', '/admin/announcement/delete/999999'],
        ['post', '/admin/announcement/send/999999'],
    ]],
];

for (const [name, permission, notFound, byCourse, byResource] of cases) {
    // Passes the JWT guard, but the user has no role in the DB.
    const token = () => `Bearer ${sign(STUDENT, [], [permission])}`;

    test(`${name}: course-scoped calls → 403 "No access to this course"`, async () => {
        for (const [method, path] of byCourse) {
            const res = await request(app)[method](path).set('Authorization', token()).send({});
            assert.strictEqual(res.status, 403, path);
            assert.deepStrictEqual(res.body, NO_ACCESS, path);
        }
    });

    test(`${name}: unknown ${name} id → 403 "${notFound}"`, async () => {
        for (const [method, path] of byResource) {
            const res = await request(app)[method](path).set('Authorization', token()).send({});
            assert.strictEqual(res.status, 403, path);
            assert.deepStrictEqual(res.body, { ...NO_ACCESS, message: notFound }, path);
        }
    });
}
