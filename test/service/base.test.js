const { test, after } = require('node:test');
const assert = require('node:assert');
const { Service, pool } = require('../../service/base');

const service = new Service();
const within = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`hung > ${ms}ms`)), ms).unref()),
]);

after(async () => {
    await pool.end();
});

test('Service.query returns rows in the standard result shape', async () => {
    const result = await service.query('SELECT 1 AS ok', []);
    assert.deepStrictEqual(result, { success: true, data: [{ ok: 1 }], rowCount: 1 });
});

test('Service.query reports SQL errors as success:false instead of throwing', async () => {
    const result = await service.query('SELECT $1::int', ['not-a-number']);
    assert.strictEqual(result.success, false);
});

// Regression: getClient() used to replace client.query with a wrapper that dropped pg's
// callback argument. pool.query() reuses the same client with a callback, so after any
// transaction the next query on that connection hung forever and leaked the connection.
test('a connection used for a transaction is still usable by Service.query afterwards', async () => {
    const client = await service.getClient();
    await client.query('BEGIN');
    await client.query('SELECT 1');
    await client.query('COMMIT');
    client.release();

    for (let i = 0; i < 3; i++) {
        const result = await within(service.query('SELECT $1::int AS n', [i]), 2000);
        assert.deepStrictEqual(result.data, [{ n: i }]);
    }
    assert.strictEqual(pool.totalCount - pool.idleCount, 0, 'no connection left checked out');
});
