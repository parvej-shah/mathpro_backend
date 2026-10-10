// Throwaway local PostgreSQL for tests.
//
// Runs a private cluster (initdb) owned by the current user on its own port, with data
// in `.testdb/` — never the system Postgres on 5432 (that port is also where the
// production SSH tunnel lands, see AGENTS.md). Requires the PostgreSQL server binaries
// (initdb/pg_ctl); override their location with PG_BIN.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, '.testdb');
const MIGRATIONS_DIR = path.join(ROOT, 'database', 'migrations');

const TEST_DB = {
    host: '127.0.0.1',
    port: 54329,
    user: 'mathpro_test',
    password: 'mathpro_test',
    database: 'mathpro_test',
};
const TEMPLATE_DB = 'mathpro_template';

function findPgBin() {
    if (process.env.PG_BIN) return process.env.PG_BIN;
    const base = '/usr/lib/postgresql';
    if (fs.existsSync(base)) {
        const versions = fs.readdirSync(base)
            .filter((v) => fs.existsSync(path.join(base, v, 'bin', 'initdb')))
            .sort((a, b) => Number(b) - Number(a));
        if (versions.length) return path.join(base, versions[0], 'bin');
    }
    return ''; // fall back to PATH (e.g. CI images with initdb on PATH)
}

const bin = (name) => {
    const dir = findPgBin();
    return dir ? path.join(dir, name) : name;
};

function isRunning() {
    try {
        execFileSync(bin('pg_isready'), ['-h', TEST_DB.host, '-p', String(TEST_DB.port)], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function ensureCluster() {
    if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
        execFileSync(bin('initdb'), ['-D', DATA_DIR, '-U', TEST_DB.user, '--auth=trust', '-E', 'UTF8'], { stdio: 'ignore' });
    }
    if (!isRunning()) {
        execFileSync(bin('pg_ctl'), [
            '-D', DATA_DIR,
            '-o', `-p ${TEST_DB.port} -k ${DATA_DIR} -c listen_addresses=${TEST_DB.host}`,
            '-l', path.join(DATA_DIR, 'log.txt'),
            'start', '-w',
        ], { stdio: 'ignore' });
    }
}

function stopCluster() {
    if (isRunning()) {
        execFileSync(bin('pg_ctl'), ['-D', DATA_DIR, 'stop', '-m', 'fast'], { stdio: 'ignore' });
    }
}

function migrationFiles() {
    return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

// `000_base_schema.sql` contains a stray "(" (line ~1304) that makes it fail on an empty
// database. Production never re-runs it (baselined in schema_migrations by checksum), and
// editing the file would change that checksum and block every future prod migration run.
// So the file stays untouched and the test bootstrap repairs it in memory only.
// See REFACTOR_PLAN.md §7.
function readMigration(file) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    if (file === '000_base_schema.sql') return sql.replace('\n\n\n(\n\n', '\n\n\n\n\n');
    return sql;
}

function migrationsHash() {
    const hash = crypto.createHash('sha256');
    for (const file of migrationFiles()) hash.update(file).update(readMigration(file));
    return hash.digest('hex');
}

async function withAdminClient(fn) {
    const client = new Client({ ...TEST_DB, database: 'postgres' });
    await client.connect();
    try {
        return await fn(client);
    } finally {
        await client.end();
    }
}

async function databaseExists(admin, name) {
    const res = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    return res.rowCount > 0;
}

// Builds the migrated template once per set of migration files (keyed by content hash),
// so each test run only pays for a fast CREATE DATABASE ... TEMPLATE.
async function ensureTemplate() {
    const hash = migrationsHash();
    const marker = path.join(DATA_DIR, 'template.hash');
    const upToDate = fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === hash;

    await withAdminClient(async (admin) => {
        if (upToDate && await databaseExists(admin, TEMPLATE_DB)) return;

        await admin.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DB}`);
        await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);

        const client = new Client({ ...TEST_DB, database: TEMPLATE_DB });
        await client.connect();
        try {
            for (const file of migrationFiles()) {
                try {
                    await client.query(readMigration(file));
                } catch (err) {
                    throw new Error(`Test DB migration ${file} failed: ${err.message}`);
                }
            }
        } finally {
            await client.end();
        }
        fs.writeFileSync(marker, hash);
    });
}

async function resetTestDatabase() {
    ensureCluster();
    await ensureTemplate();
    await withAdminClient(async (admin) => {
        await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB.database} WITH (FORCE)`);
        await admin.query(`CREATE DATABASE ${TEST_DB.database} TEMPLATE ${TEMPLATE_DB}`);
    });
}

module.exports = {
    TEST_DB,
    ensureCluster,
    stopCluster,
    resetTestDatabase,
};
