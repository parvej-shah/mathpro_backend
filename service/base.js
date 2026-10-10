require('dotenv').config(); // Load environment variables
const Pool = require('pg').Pool;
const {
    formatQueryLog,
    nowMs,
    shouldLogQuery,
} = require('../util/observability');
const logger = require('../util/logger');
const { AppError } = require('../errors/AppError');
const { describeDbError, toAppError } = require('../errors/dbErrors');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DB,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    port: process.env.DB_PORT,
    // Opt-in SSL: only enable when DB_SSL is explicitly 'true'. A missing/unknown
    // value must default to OFF, otherwise SSL is attempted against a non-SSL
    // Postgres and every connection is rejected, wedging the pool.
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    // pg defaults to max:10, which serializes queries under concurrent load —
    // every authenticated request already runs an isSessionActive query, so 10
    // in-flight requests alone can saturate the pool. Raised to give headroom;
    // override via DB_POOL_MAX if the DB's own connection limit is lower.
    max: parseInt(process.env.DB_POOL_MAX) || 30,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    // Without TCP keepalive, a connection silently dropped by the network (NAT/firewall
    // timeout) never errors out — the pool keeps treating it as healthy and every query
    // routed to it hangs until connectionTimeoutMillis, wedging the whole pool. Keepalive
    // probes let the OS detect the dead socket so pg can evict and replace it.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
})

// An error on an idle client (dropped connection, DB restart) would otherwise be
// an unhandled 'error' event. Log it and let pg evict the client from the pool.
pool.on('error', (err) => {
    console.error('Unexpected error on idle pg client', err);
})



function getQueryText(query) {
    if (typeof query === 'string') return query;
    if (query && typeof query.text === 'string') return query.text;
    return '';
}

async function runTimedQuery(executor, query, params, meta) {
    const startedAt = nowMs();
    const result = await executor(query, params);
    const durationMs = nowMs() - startedAt;

    if (shouldLogQuery(durationMs)) {
        console.log(JSON.stringify(formatQueryLog({
            durationMs,
            rowCount: result.rowCount,
            sql: getQueryText(query),
            source: meta.source,
            pooled: meta.pooled,
        })));
    }

    return result;
}

class Service {
    constructor() { }

    query = async function (query, params) {
        try {
            const data = await runTimedQuery(
                pool.query.bind(pool),
                query,
                params,
                { source: 'Service.query', pooled: true }
            );
            return {
                success: true,
                data: data.rows,
                rowCount: data.rowCount
            }
        } catch (error) {
            // The raw pg error (SQL, constraint names, row values) stays in the server log;
            // callers and clients get a safe message string.
            logger.error('db_error', error, { source: 'Service.query', sql: getQueryText(query).slice(0, 500) });
            return {
                success: false,
                error: describeDbError(error).message
            }
        }
    }

    // Like query(), but throws an AppError (mapped from the pg error code) instead of
    // returning success:false. Resolves to the pg result ({ rows, rowCount }).
    queryOrThrow = async function (query, params) {
        try {
            return await runTimedQuery(pool.query.bind(pool), query, params, { source: 'Service.queryOrThrow', pooled: true });
        } catch (error) {
            logger.error('db_error', error, { source: 'Service.queryOrThrow', sql: getQueryText(query).slice(0, 500) });
            throw toAppError(error);
        }
    }

    // Runs fn(client) inside BEGIN/COMMIT on one pooled client. Any throw rolls back and
    // is rethrown; the client is always released. Resolves to fn's return value.
    withTransaction = async function (fn) {
        const client = await this.getClient();
        // Passing an error to release() destroys the connection instead of pooling it.
        let releaseWith;
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            if (!(error instanceof AppError)) logger.error('db_error', error, { source: 'Service.withTransaction' });
            // A failed ROLLBACK means the connection itself is broken.
            await client.query('ROLLBACK').catch((rollbackError) => { releaseWith = rollbackError; });
            throw error;
        } finally {
            client.release(releaseWith);
        }
    }

    // Get a client from the pool for transactions
    // IMPORTANT: Always call client.release() when done!
    getClient = async function () {
        const client = await pool.connect();

        if (client.__mathproTimedQueryWrapped) {
            return client;
        }

        // The wrapper stays on this pooled client after release, so it must keep pg's full
        // query() contract: pool.query() later calls client.query(text, values, callback) and
        // waits for the callback. Dropping it hung that request forever and leaked the client.
        const originalQuery = client.query.bind(client);
        client.query = (query, params, callback) => {
            if (typeof params === 'function' || typeof callback === 'function'
                || (query && typeof query.submit === 'function')) {
                return originalQuery(query, params, callback);
            }
            return runTimedQuery(
                originalQuery,
                query,
                params,
                { source: 'Service.getClient', pooled: false }
            );
        };
        client.__mathproTimedQueryWrapped = true;

        return client;
    }
}
exports.Service = Service;

exports.pool = pool;
