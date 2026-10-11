// Every admin endpoint that re-checks course access against the caller's DB roles answers a
// caller without that access 403 NO_COURSE_ACCESS (the JWT alone passes the route guard).
// Pins the shared denyCourseAccess helper (phase R, R6) across the controllers that use it.
// Announcement, routine and module-feedback routes are pinned in their own tests.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, sign, pool } = require('../helpers/fixtures');
const { ALL_PERMISSIONS } = require('../../util/permissions');

// A managerial account with every permission in its token but no role in the DB.
const NO_ROLE = { id: 832, name: 'No Role Admin', type: 1, login: 'norole@test.local' };
const token = () => sign(NO_ROLE, [], ALL_PERMISSIONS);
const DENIED = { success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' };

before(async () => {
    await seed();
    await pool.query(`INSERT INTO managerial_auth (id, name, type, login, password, email, profile)
                      VALUES (832, 'No Role Admin', 1, 'norole@test.local', 'x', 'norole@test.local', '{}') ON CONFLICT DO NOTHING`);
});

after(() => pool.end());

const calls = [
    ['post', '/admin/chapter/create/1', { title: 'C', serial: 1 }],
    ['post', '/admin/module/create/1', { title: 'M', serial: 1 }],
    ['get', '/admin/course/get/1'],
    ['get', '/admin/course/getfull/1'],
    ['get', '/admin/course/getUserProgress/1/2'],
    ['get', '/admin/course/getAllCoursePerchasesApi?identifier=639'],
    ['get', '/admin/course/getAllPrebookingsApi?identifier=639'],
    ['get', '/v2/admin/course/1'],
    ['get', '/v2/admin/course/1/full'],
    ['get', '/v2/admin/course/1/user-progress/2'],
    ['put', '/v2/admin/course/1/modules/reorder', { modules: [{ id: 1, serial: 1 }] }],
    ['get', '/v2/admin/course/1/getFull-enhanced'],
    ['get', '/v2/admin/course/1/export'],
    ['get', '/admin/revenue/detailed/1'],
    ['get', '/admin/analytics/courses/1/detailed'],
    ['get', '/admin/analytics/revenue/summary?course_id=1'],
];

for (const [method, path, body] of calls) {
    test(`${method.toUpperCase()} ${path}: 403 NO_COURSE_ACCESS without access to the course`, async () => {
        const res = await request(app)[method](path).set('Authorization', `Bearer ${token()}`).send(body || {});
        assert.deepStrictEqual([res.status, res.body], [403, DENIED]);
    });
}

// Chapter/module writes look the course up from the resource first: an unknown id is still a
// 403 NO_COURSE_ACCESS, with "<Resource> not found" as the message.
const resourceCalls = [
    ['put', '/admin/chapter/update', 'Chapter not found'],
    ['delete', '/admin/chapter/delete', 'Chapter not found'],
    ['put', '/admin/module/update', 'Module not found'],
    ['delete', '/admin/module/delete', 'Module not found'],
];

for (const [method, path, notFound] of resourceCalls) {
    test(`${method.toUpperCase()} ${path}/:id: 403 for a course without access, "${notFound}" for an unknown id`, async () => {
        const auth = { Authorization: `Bearer ${token()}` };
        const known = await request(app)[method](`${path}/1`).set(auth).send({ title: 'x' });
        assert.deepStrictEqual([known.status, known.body], [403, DENIED]);
        const unknown = await request(app)[method](`${path}/999999`).set(auth).send({ title: 'x' });
        assert.deepStrictEqual([unknown.status, unknown.body], [403, { ...DENIED, message: notFound }]);
    });
}
