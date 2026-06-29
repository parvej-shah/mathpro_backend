require('dotenv').config(); // Load environment variables
const Pool = require('pg').Pool;
const {
    formatQueryLog,
    nowMs,
    shouldLogQuery,
} = require('../util/observability');

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
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
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
            console.log(error)
            return {
                success: false,
                error
            }
        }
    }

    // Get a client from the pool for transactions
    // IMPORTANT: Always call client.release() when done!
    getClient = async function () {
        const client = await pool.connect();

        if (client.__mathproTimedQueryWrapped) {
            return client;
        }

        const originalQuery = client.query.bind(client);
        client.query = async (query, params) => {
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
