// V2 upload endpoints (Admin: presigned-url + delete, Frontend: presigned-url): the exact
// error replies, including the 500-vs-4xx split on storage misconfiguration.
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../app');
const presignedUploadService = require('../../util/presignedUploadService');
const { adminToken, studentToken, pool } = require('../helpers/fixtures');

after(async () => {
    await pool.end();
});

const post = (path, token, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
const reply = (res) => {
    const { timestamp, ...rest } = res.body;
    assert.ok(!Number.isNaN(Date.parse(timestamp)), 'timestamp is an ISO date');
    return { status: res.status, body: rest };
};

// Runs `fn` with the storage bucket unset, so the service reports a configuration error.
const withoutBucket = async (fn) => {
    const bucket = presignedUploadService.bucket;
    presignedUploadService.bucket = '';
    try {
        return await fn();
    } finally {
        presignedUploadService.bucket = bucket;
    }
};

for (const [who, path, token] of [
    ['student', '/v2/user/upload/presigned-url', studentToken],
    ['admin', '/v2/admin/upload/presigned-url', adminToken],
]) {
    test(`${who} presigned-url: missing purpose, unknown purpose, storage misconfigured`, async () => {
        assert.deepStrictEqual(reply(await post(path, token(), {})), {
            status: 422,
            body: { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: { purpose: 'purpose is required' } },
        });
        assert.deepStrictEqual(reply(await post(path, token(), { purpose: 'nope' })), {
            status: 422,
            body: { success: false, error: 'Unsupported upload purpose: nope', code: 'INVALID_UPLOAD_PURPOSE' },
        });
        assert.deepStrictEqual(reply(await withoutBucket(() => post(path, token(), { purpose: 'nope' }))), {
            status: 500,
            body: { success: false, error: 'Storage bucket is not configured', code: 'UPLOAD_CONFIGURATION_ERROR' },
        });
    });
}

test('admin delete: missing identifier, bad public URL, storage misconfigured', async () => {
    const path = '/v2/admin/upload/delete';
    assert.deepStrictEqual(reply(await post(path, adminToken(), {})), {
        status: 422,
        body: { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: { key: 'key or public_url is required' } },
    });
    assert.deepStrictEqual(reply(await post(path, adminToken(), { public_url: 'not a url' })), {
        status: 400,
        body: { success: false, error: 'Public URL is invalid', code: 'INVALID_UPLOAD_IDENTIFIER' },
    });
    assert.deepStrictEqual(reply(await withoutBucket(() => post(path, adminToken(), { key: 'a/b.png' }))), {
        status: 500,
        body: { success: false, error: 'Storage bucket is not configured', code: 'UPLOAD_CONFIGURATION_ERROR' },
    });
});
