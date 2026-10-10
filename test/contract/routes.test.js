// Characterization test for the whole HTTP contract.
//
// Hits every mounted endpoint as {anonymous, student, admin} and records what the clients
// can observe: status code, body kind, `success`, top-level keys, and the *type* of `error`
// (values are deliberately not recorded — they are volatile). The result is compared to
// test/contract/__snapshots__/routes.json. A refactor must keep this snapshot unchanged;
// an intentional contract change regenerates it with `npm run test:update` and the diff is
// reviewed like any other code change.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { loadAppWithRouteTable, fillParams } = require('../helpers/routes');
const { Client } = require('pg');
const { seed, adminToken, studentToken, pool } = require('../helpers/fixtures');
const { TEST_DB } = require('../helpers/testDb');

const SNAPSHOT = path.join(__dirname, '__snapshots__', 'routes.json');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';
const METHOD_ORDER = { get: 0, post: 1, put: 2, patch: 3, delete: 4 };

const { app, routes } = loadAppWithRouteTable();

function describeBody(res) {
    const type = res.headers['content-type'] || '';
    if (res.status >= 300 && res.status < 400) {
        const loc = (res.headers.location || '').split('?')[0];
        return { kind: 'redirect', location: loc };
    }
    if (!type.includes('json')) {
        return { kind: type.split(';')[0] || 'empty' };
    }
    const body = res.body;
    if (Array.isArray(body)) return { kind: 'json-array' };
    if (body === null || typeof body !== 'object') return { kind: `json-${typeof body}` };
    const out = { kind: 'json', keys: Object.keys(body).sort().join(',') };
    if ('success' in body) out.success = body.success;
    if ('error' in body) out.error = body.error === null ? 'null' : typeof body.error;
    if ('data' in body) out.data = Array.isArray(body.data) ? 'array' : body.data === null ? 'null' : typeof body.data;
    return out;
}

async function hit(route, token) {
    const url = fillParams(route.path);
    let req = request(app)[route.method](url).timeout(8000);
    if (token) req = req.set('Authorization', `Bearer ${token}`);
    if (route.method !== 'get' && route.method !== 'delete') req = req.send({});
    let out;
    const startedAt = Date.now();
    try {
        const res = await req;
        out = { status: res.status, ...describeBody(res) };
    } catch (err) {
        out = { status: err.timeout ? 'TIMEOUT' : `ERROR:${err.code || err.message}` };
    }
    if (unhandled.length) {
        out.unhandledRejections = unhandled.length;
        unhandled.length = 0;
    }
    timings.push([Date.now() - startedAt, `${route.method.toUpperCase()} ${route.path} [${token ? 'auth' : 'anon'}]`]);
    // A handler that returns while still holding a pooled client (e.g. an open transaction
    // with no release) is a connection leak; record it so it shows up in the snapshot.
    await new Promise((r) => setTimeout(r, 5));
    const checkedOut = pool.totalCount - pool.idleCount;
    if (checkedOut > leakedSoFar) {
        out.leakedClients = checkedOut - leakedSoFar;
        leakedSoFar = checkedOut;
    }
    // A client returned to the pool mid-transaction keeps its locks and poisons whoever
    // reuses it. Watch for sessions left "idle in transaction".
    const { rows } = await monitor.query(
        `SELECT count(*)::int AS n FROM pg_stat_activity
         WHERE datname = $1 AND state LIKE 'idle in transaction%'`, [TEST_DB.database]);
    if (rows[0].n > openTxSoFar) {
        out.openTransactions = rows[0].n - openTxSoFar;
    }
    openTxSoFar = rows[0].n;
    return out;
}

let leakedSoFar = 0;
// Unhandled rejections from a handler mean the request may never get a response (index.js
// only logs them). Record them against the request in flight instead of crashing the run.
const unhandled = [];
process.on('unhandledRejection', (err) => unhandled.push(err));
let openTxSoFar = 0;
const timings = [];
const monitor = new Client(TEST_DB);
const checkedOutClients = new Set();
pool.on('acquire', (client) => checkedOutClients.add(client));
pool.on('release', (_err, client) => checkedOutClients.delete(client));

before(async () => {
    await monitor.connect();
    await seed();
});

after(async () => {
    // pool.end() waits for every checked-out client, so destroy the leaked ones first.
    // Slowest requests, for diagnosing a slow sweep (gitignored).
    fs.writeFileSync(path.join(__dirname, '..', '..', '.testdb', 'sweep-timings.json'),
        JSON.stringify(timings.sort((a, b) => b[0] - a[0]).slice(0, 40), null, 1));
    for (const client of checkedOutClients) client.release(true);
    await pool.end();
    await monitor.end();
});

test('every endpoint keeps its observable contract', { timeout: 600000 }, async () => {
    // Stable order independent of mount order: reads first, destructive verbs last.
    const ordered = [...routes].sort((a, b) =>
        (METHOD_ORDER[a.method] ?? 9) - (METHOD_ORDER[b.method] ?? 9) || a.path.localeCompare(b.path));
    const modes = [['anon', null], ['student', studentToken()], ['admin', adminToken()]];

    const actual = {};
    for (const route of ordered) {
        for (const [mode, token] of modes) {
            actual[`${route.method.toUpperCase()} ${route.path} [${mode}]`] = await hit(route, token);
        }
    }

    if (UPDATE || !fs.existsSync(SNAPSHOT)) {
        fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
        fs.writeFileSync(SNAPSHOT, `${JSON.stringify(actual, null, 1)}\n`);
        return;
    }

    const expected = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const diffs = [];
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
        const a = JSON.stringify(actual[key]);
        const e = JSON.stringify(expected[key]);
        if (a !== e) diffs.push(`${key}\n    expected: ${e}\n    actual:   ${a}`);
    }
    assert.strictEqual(diffs.length, 0, `Contract changed for ${diffs.length} endpoint(s):\n${diffs.join('\n')}`);
});
