// List endpoints that parse page/limit/offset with util/pagination (phase R, R2): valid values
// are echoed unchanged, and a zero, negative or non-numeric value falls back to the endpoint's
// default instead of reaching SQL (which used to give null/negative page meta, 400s or 500s).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const { seed, sign, adminToken, studentToken, pool } = require('../helpers/fixtures');
const { PERMISSIONS } = require('../../util/permissions');

// A manager whose DB role grants announcement.manage.all (course-scoped routes check the DB).
const MANAGER = { id: 821, name: 'Announcement Manager', type: 1, login: 'am@test.local' };
const managerToken = () => sign(MANAGER, [], [PERMISSIONS.ANNOUNCEMENT.MANAGE.ALL]);

before(async () => {
    await seed();
    await pool.query(`INSERT INTO managerial_auth (id, name, type, login, password, email, profile)
                      VALUES (821, 'Announcement Manager', 1, 'am@test.local', 'x', 'am@test.local', '{}') ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO roles (id, name, display_name, permissions)
                      VALUES (821, 'announcement_manager_test', 'Announcement Manager', $1) ON CONFLICT DO NOTHING`,
    [JSON.stringify([PERMISSIONS.ANNOUNCEMENT.MANAGE.ALL])]);
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES (821, 821) ON CONFLICT DO NOTHING');
});
after(() => pool.end());

const metaOf = (body) => body.pagination || body.data?.pagination || { page: body.page, limit: body.limit };
const BAD = ['page=0&limit=0&offset=0', 'page=abc&limit=abc&offset=abc', 'page=-1&limit=-1&offset=-1'];

// path, default limit, and where the page meta lives
const pageLists = [
    ['/admin/coupon', 10],
    ['/admin/coupon/analytics/usage-report', 50],
    ['/admin/coupon/coupon-clicks', 20],
    ['/admin/users', 20],
    ['/admin/feedback', 20],
    ['/admin/module-feedback', 20],
];

for (const [path, defaultLimit] of pageLists) {
    test(`${path}: page/limit echoed, bad values fall back to page 1 / limit ${defaultLimit}`, async () => {
        const auth = { Authorization: `Bearer ${adminToken()}` };
        const ok = await request(app).get(`${path}?page=2&limit=5`).set(auth);
        assert.strictEqual(ok.status, 200);
        assert.deepStrictEqual([metaOf(ok.body).page, metaOf(ok.body).limit], [2, 5]);

        for (const q of BAD) {
            const res = await request(app).get(`${path}?${q}`).set(auth);
            assert.strictEqual(res.status, 200, `${path}?${q}`);
            assert.deepStrictEqual([metaOf(res.body).page, metaOf(res.body).limit], [1, defaultLimit], `${path}?${q}`);
        }
    });
}

const limitLists = [
    ['/admin/coupon/analytics/top-performing', adminToken],
    ['/admin/payment/audit-logs', adminToken],
    ['/admin/analytics/revenue/by-course', adminToken],
    ['/admin/analytics/learning/streaks', adminToken],
    ['/admin/streak/leaderboard/1', adminToken],
    ['/user/course/1/announcements', studentToken],
    ['/user/streak/leaderboard/1', studentToken],
];

for (const [path, token] of limitLists) {
    test(`${path}: bad limit/offset values are a 200, not an error`, async () => {
        for (const q of ['limit=5&offset=5', ...BAD]) {
            const res = await request(app).get(`${path}?${q}`).set('Authorization', `Bearer ${token()}`);
            assert.strictEqual(res.status, 200, `${path}?${q}`);
            assert.notStrictEqual(res.body.success, false, `${path}?${q}`);
        }
    });
}

// These had no default: a missing limit/offset reached SQL as NaN. They now default to the
// page size their client already sends (Admin 100, Frontend 10).
const noDefaultLists = [
    ['/admin/announcement/list', adminToken],
    ['/admin/announcement/list/1', managerToken],
    ['/user/notification/list?courseId=1&', studentToken],
    ['/user/course/getRanking/1', studentToken],
];

for (const [path, token] of noDefaultLists) {
    test(`${path}: works with, without and with bad limit/offset`, async () => {
        const base = path.includes('?') ? path : `${path}?`;
        for (const q of ['limit=5&offset=0', '', ...BAD]) {
            const res = await request(app).get(`${base}${q}`).set('Authorization', `Bearer ${token()}`);
            assert.strictEqual(res.status, 200, `${base}${q} ${JSON.stringify(res.body).slice(0, 120)}`);
        }
    });
}
