// Preloaded into every test process (`node --test --require ./test/setup.js`).
// Must run before anything requires service/base.js: dotenv never overrides variables that
// are already set, so pinning every DB_* var here keeps `.env` (production) out of tests.
const { TEST_DB } = require('./helpers/testDb');

Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_HOST: TEST_DB.host,
    DB_PORT: String(TEST_DB.port),
    DB_USER: TEST_DB.user,
    DB_PASSWORD: TEST_DB.password,
    DB_PASS: TEST_DB.password,
    DB_DB: TEST_DB.database,
    DB_SSL: 'false',
    JWT_SECRET: 'test-jwt-secret',
    FRONTEND_URL: 'http://frontend.test',
    BACKEND_URL: 'http://backend.test',
    REVALIDATE_SECRET: '',
    // Blank out every external integration so nothing real is reachable even by accident.
    STORE_ID: 'test', STORE_PASSWORD: 'test', IS_LIVE: 'false',
    BULKSMS_API_KEY: '', BULKSMS_SENDER_ID: '',
    R2_ACCOUNT_ID: 'test', R2_BUCKET: 'test', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test',
    R2_PUBLIC_URL_BASE: 'http://cdn.test',
    AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test',
    EMAIL_USER: '', EMAIL_PASS: '', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1',
    LOG_ALL_REQUESTS: 'false', LOG_ALL_DB_QUERIES: 'false',
});

if (process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== String(TEST_DB.port)) {
    throw new Error('Refusing to run tests: DB target is not the local throwaway test cluster.');
}

// Network guard: tests may only talk to localhost. Any outbound call (SSLCommerz, SMS,
// SMTP, S3/R2, Google, frontend revalidation) fails loudly instead of leaving the machine.
const net = require('net');
const LOCAL = new Set(['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1']);
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
    const opts = typeof args[0] === 'object' && args[0] !== null ? args[0] : { port: args[0], host: args[1] };
    const host = opts.host || 'localhost';
    if (!opts.path && !LOCAL.has(host)) {
        const err = new Error(`Blocked outbound network call to ${host}:${opts.port} during tests`);
        process.nextTick(() => this.destroy(err));
        return this;
    }
    return originalConnect.apply(this, args);
};

// Keep test output readable: the app logs liberally to console.
if (!process.env.TEST_VERBOSE) {
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
}
