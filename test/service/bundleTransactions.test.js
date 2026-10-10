const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { STUDENT, COURSE_ID, seed, pool } = require('../helpers/fixtures');
const { BundleService } = require('../../service/managerial/bundle');

// Regression: bundle delete / addCoursesToBundle sent BEGIN/COMMIT through the pool, so
// nothing was atomic. A failure part-way kept the earlier deletes and reported success,
// and the stray BEGIN could leave a pooled connection idle inside a transaction.
const bundles = new BundleService();
const BUNDLE_ID = 1;

const links = async () =>
    (await pool.query('SELECT course_id FROM bundle_course WHERE bundle_id = $1 ORDER BY course_id', [BUNDLE_ID]))
        .rows.map((r) => r.course_id);

before(async () => {
    await seed();
});

after(async () => {
    await pool.end();
});

test('a bundle delete that fails part-way keeps its course links', async () => {
    // A purchase references the bundle, so the final DELETE FROM bundle fails.
    await pool.query(
        `INSERT INTO bundle_purchase (user_id, bundle_id, amount, transaction_id, timestamp)
         VALUES ($1, $2, 1000, 'TX-BUNDLE-FK', 0) ON CONFLICT DO NOTHING`,
        [STUDENT.id, BUNDLE_ID]
    );
    const before = await links();
    assert.deepStrictEqual(before, [COURSE_ID]);

    const result = await bundles.delete(BUNDLE_ID);
    assert.strictEqual(result.success, false);
    assert.deepStrictEqual(await links(), before, 'course links must survive the failed delete');
});

test('replacing bundle courses with a bad course id changes nothing', async () => {
    const before = await links();
    const result = await bundles.addCoursesToBundle(BUNDLE_ID, [COURSE_ID, 999999]);
    assert.strictEqual(result.success, false);
    assert.deepStrictEqual(await links(), before);
});

test('under concurrent DB traffic the steps stay on one connection and nothing is stranded', async () => {
    // Other requests saturate the pool, so statements sent through the pool
    // land on different connections. A BEGIN sent that way strands its connection
    // idle inside a transaction.
    let running = true;
    const traffic = Array.from({ length: 40 }, async () => { // more than the pool size (30)
        while (running) await pool.query('SELECT pg_sleep(0.005)');
    });
    for (let i = 0; i < 20; i++) {
        await bundles.addCoursesToBundle(BUNDLE_ID, [COURSE_ID]);
        await bundles.delete(BUNDLE_ID); // fails on the purchase FK every time
    }
    running = false;
    await Promise.all(traffic);
    assert.deepStrictEqual(await links(), [COURSE_ID]);
});

test('no connection is left checked out or idle inside a transaction', async () => {
    assert.strictEqual(pool.totalCount - pool.idleCount, 0);
    const stuck = await pool.query(
        `SELECT count(*)::int AS n FROM pg_stat_activity
         WHERE datname = current_database() AND state LIKE 'idle in transaction%'`
    );
    assert.strictEqual(stuck.rows[0].n, 0);
});
