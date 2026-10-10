const { test, after } = require('node:test');
const assert = require('node:assert');
const { Service, pool } = require('../../service/base');
const { AppError, ValidationError } = require('../../errors/AppError');

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

test('Service.query reports SQL errors as success:false with a safe message, not the pg error', async () => {
    const result = await service.query('SELECT $1::int', ['not-a-number']);
    assert.deepStrictEqual(result, { success: false, error: 'Invalid input format.' });

    const unknown = await service.query('SELECT * FROM no_such_table', []);
    assert.deepStrictEqual(unknown, { success: false, error: 'Database error.' });
});

test('Service.queryOrThrow maps pg error codes to AppError statuses', async () => {
    const res = await service.queryOrThrow('SELECT $1::int AS n', [7]);
    assert.deepStrictEqual(res.rows, [{ n: 7 }]);

    await assert.rejects(service.queryOrThrow('SELECT $1::int', ['x']),
        (err) => err instanceof AppError && err.status === 400 && err.message === 'Invalid input format.');
    await assert.rejects(service.queryOrThrow('SELECT * FROM no_such_table', []),
        (err) => err instanceof AppError && err.status === 500 && err.cause.code === '42P01');
    await service.query('CREATE TABLE IF NOT EXISTS uniq_probe (id int PRIMARY KEY)', []);
    await service.queryOrThrow('INSERT INTO uniq_probe VALUES (1) ON CONFLICT DO NOTHING', []);
    await assert.rejects(service.queryOrThrow('INSERT INTO uniq_probe VALUES (1)', []),
        (err) => err.status === 409 && err.message === 'A record with the same value already exists.');
    await service.query('DROP TABLE uniq_probe', []);
});

test('withTransaction commits on success, rolls back on throw or a success:false result, without leaking clients', async () => {
    await service.query('CREATE TABLE IF NOT EXISTS tx_probe (v int)', []);
    await service.query('TRUNCATE tx_probe', []);

    const value = await service.withTransaction(async (client) => {
        await client.query('INSERT INTO tx_probe VALUES (1)');
        return 'done';
    });
    assert.strictEqual(value, 'done');

    await assert.rejects(service.withTransaction(async (client) => {
        await client.query('INSERT INTO tx_probe VALUES (2)');
        throw new ValidationError('nope');
    }), ValidationError);

    await assert.rejects(service.withTransaction(async (client) => {
        await client.query('INSERT INTO tx_probe VALUES (3)');
        await client.query('SELECT $1::int', ['bad']);
    }), (err) => err.code === '22P02');

    const failed = await service.withTransaction(async (client) => {
        await client.query('INSERT INTO tx_probe VALUES (4)');
        return { success: false, error: 'Quiz already submitted' };
    });
    assert.deepStrictEqual(failed, { success: false, error: 'Quiz already submitted' });

    const rows = await service.query('SELECT v FROM tx_probe ORDER BY v', []);
    assert.deepStrictEqual(rows.data, [{ v: 1 }]);
    assert.strictEqual(pool.totalCount - pool.idleCount, 0, 'no connection left checked out');
    await service.query('DROP TABLE tx_probe', []);
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
