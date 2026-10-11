// RevenueAnalyticsService (Admin analytics V2 revenue pages): summary, trends, per course /
// bundle and predictions, for a global admin, a course-scoped admin and one with no courses.
// Outputs are compared with test/service/__snapshots__/revenue.json; pinned before revenue.js is
// split (REFACTOR_PLAN.md task 4.6). Regenerate with UPDATE_SNAPSHOTS=1 and review the diff.
//
// The seeded sales are all in 2001 and every call is limited to 2001 (or a fake "now" in 2001),
// so payments written by other test files in the shared database never reach these numbers.
process.env.TZ = 'UTC';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { seed, pool } = require('../helpers/fixtures');
const { RevenueAnalyticsService } = require('../../service/managerial/analyticsV2/parts/revenue');

const SNAPSHOT = path.join(__dirname, '__snapshots__', 'revenue.json');
const revenue = new RevenueAnalyticsService();
const at = (month, day) => Date.UTC(2001, month - 1, day, 12) / 1000;
const YEAR_2001 = { startDate: Date.UTC(2001, 0, 1) / 1000, endDate: Date.UTC(2001, 11, 31, 23, 59, 59) / 1000 };

const MINE = [9101, 9102]; // courses and bundles seeded here
const GLOBAL = { hasGlobalAccess: true };
const SCOPED = { hasGlobalAccess: false, courseIds: [9101] };
const NO_COURSES = { hasGlobalAccess: false, courseIds: [] };
const ACCESS = { global: GLOBAL, scoped: SCOPED, noCourses: NO_COURSES };

before(async () => {
    pool.on('connect', (client) => client.query(`SET TIME ZONE 'UTC'`));
    await seed();
    await pool.query(`
        INSERT INTO managerial_auth (id, name, type, login, password, profile) VALUES
            (981, 'R1', 3, 'r981', 'x', '{}'), (982, 'R2', 3, 'r982', 'x', '{}'), (983, 'R3', 3, 'r983', 'x', '{}'),
            (984, 'R4', 3, 'r984', 'x', '{}'), (985, 'R5', 3, 'r985', 'x', '{}');
        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free) VALUES
            (9101, 'Revenue In Scope', 1000, 1000, true, true, 9101, 'rev-in', 'rev-in', '[]', false),
            (9102, 'Revenue Out Of Scope', 1000, 1000, true, true, 9102, 'rev-out', 'rev-out', '[]', false);
        INSERT INTO bundle (id, title, price, is_live, is_active) VALUES
            (9101, 'Bundle In Scope', 900, true, true), (9102, 'Bundle Out Of Scope', 700, true, true);
        INSERT INTO bundle_course (bundle_id, course_id) VALUES (9101, 9101), (9102, 9102);
        INSERT INTO coupons (id, name, code, discount_type, discount_value, start_time, end_time, status, created_at, updated_at)
            VALUES (9101, 'Rev', 'REV9101', 'fixed', 200, 1, 2000000000, 'active', 1, 1);
        INSERT INTO takes (user_id, course_id, timestamp, amount, transaction_id, coupon_id) VALUES
            (981, 9101, ${at(3, 10)}, 1000, 'rev-t1', NULL),
            (982, 9101, ${at(3, 10)}, 800, 'rev-t2', 9101),
            (983, 9102, ${at(4, 15)}, 500, 'rev-t3', NULL),
            (984, 9101, ${at(4, 15)}, NULL, NULL, NULL),
            (985, 9102, ${at(5, 20)}, 1200, 'rev-t5', 9101);
        INSERT INTO bundle_purchase (user_id, bundle_id, amount, transaction_id, timestamp, coupon_id) VALUES
            (981, 9101, 900, 'rev-b1', ${at(3, 10)}, NULL),
            (983, 9102, 700, 'rev-b2', ${at(5, 20)}, 9101);
        INSERT INTO coupon_usage (coupon_id, user_id, course_id, bundle_id, original_price, discount_amount, final_price, used_at, payment_status) VALUES
            (9101, 982, 9101, NULL, 1000, 200, 800, ${at(3, 10)}, 'completed'),
            (9101, 985, 9102, NULL, 1500, 300, 1200, ${at(5, 20)}, 'completed'),
            (9101, 983, NULL, 9102, 900, 200, 700, ${at(5, 20)}, 'completed'),
            (9101, 981, 9101, NULL, 1000, 100, 900, ${at(3, 10)}, 'pending');
    `);
});

after(async () => {
    await pool.end();
});

// For a global admin the listings page over every course/bundle in the database; keep only the
// seeded ones and check the total against a live count instead of the snapshot.
const onlyMine = async (result, listKey, idKey, table, access) => {
    if (!result.success || access !== GLOBAL) return result;
    const { data } = result;
    const live = (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
    assert.strictEqual(data.meta.total, live, `${listKey} total`);
    return { ...result, data: { ...data, [listKey]: data[listKey].filter((r) => MINE.includes(r[idKey])), meta: { ...data.meta, total: 'live' } } };
};

const withNow = async (seconds, fn) => {
    const realNow = Date.now;
    Date.now = () => seconds * 1000;
    try {
        return await fn();
    } finally {
        Date.now = realNow;
    }
};

async function record() {
    const out = {};
    for (const [who, access] of Object.entries(ACCESS)) {
        out[`summary ${who}`] = await revenue.getRevenueSummary(YEAR_2001, access);
        out[`summary ${who} by month`] = await revenue.getRevenueSummary({ ...YEAR_2001, groupBy: 'month' }, access);
        out[`trends ${who} by day`] = await revenue.getRevenueTrends(YEAR_2001, access);
        out[`trends ${who} by month`] = await revenue.getRevenueTrends({ ...YEAR_2001, groupBy: 'month' }, access);
        out[`byCourse ${who}`] = await onlyMine(await revenue.getRevenueByCourse({ ...YEAR_2001, limit: 100 }, access), 'courses', 'course_id', 'course', access);
        out[`byBundle ${who}`] = await onlyMine(await revenue.getRevenueByBundle({ ...YEAR_2001, limit: 100 }, access), 'bundles', 'bundle_id', 'bundle', access);
    }
    out['summary filtered to course 9102 and bundle 9101'] = await revenue.getRevenueSummary({ ...YEAR_2001, courseId: 9102, bundleId: 9101 }, GLOBAL);
    out['trends filtered to course 9102 and bundle 9101'] = await revenue.getRevenueTrends({ ...YEAR_2001, courseId: 9102, bundleId: 9101 }, GLOBAL);
    out['trends without dates'] = await revenue.getRevenueTrends({}, GLOBAL);
    out['byCourse scoped, asc by enrollments, paged'] = await revenue.getRevenueByCourse({ ...YEAR_2001, sortBy: 'enrollments', order: 'asc', limit: 1, offset: 0 }, SCOPED);
    out['byCourse scoped, junk paging'] = await revenue.getRevenueByCourse({ ...YEAR_2001, limit: -5, offset: 'x' }, SCOPED);
    out['byBundle scoped, by purchases'] = await revenue.getRevenueByBundle({ ...YEAR_2001, sortBy: 'purchases', order: 'asc' }, SCOPED);

    out['predictions bad period'] = await revenue.getRevenuePredictions({ period: 'decade' }, GLOBAL);
    const nows = { 'mid-2001': at(6, 1), 'start-2002': Date.UTC(2002, 0, 1) / 1000 };
    for (const [label, now] of Object.entries(nows)) {
        for (const period of ['week', 'month', 'quarter', 'year']) {
            for (const method of ['average', 'trend', 'other']) {
                for (const who of ['global', 'scoped']) {
                    out[`predictions ${period} ${method} ${who} at ${label}`] =
                        await withNow(now, () => revenue.getRevenuePredictions({ period, method }, ACCESS[who]));
                }
            }
        }
    }
    return out;
}

test('revenue analytics outputs match the snapshot', async () => {
    const actual = JSON.parse(JSON.stringify(await record()));
    if (process.env.UPDATE_SNAPSHOTS || !fs.existsSync(SNAPSHOT)) {
        fs.writeFileSync(SNAPSHOT, JSON.stringify(actual, null, 1) + '\n');
    }
    const expected = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    for (const key of Object.keys(expected)) assert.deepStrictEqual(actual[key], expected[key], key);
    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected));
});

test('the seeded sales are what the summary adds up', async () => {
    const { data } = await revenue.getRevenueSummary(YEAR_2001, GLOBAL);
    assert.deepStrictEqual(
        [data.course_revenue, data.bundle_revenue, data.total_transactions, data.with_coupon_revenue, data.discount_given],
        [3500, 1600, 6, 2700, 700]
    );
});
