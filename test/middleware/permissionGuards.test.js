// Pins the exact responses of the RBAC guards in service/authMiddleWares.js (401/403 bodies,
// what an allowed request gets attached), so the guards can share one implementation
// without either client noticing. Both Admin (every /admin route) and Frontend rely on these.
const { test, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { pool } = require('../../service/base');
const {
    requirePermission, requireAnyPermission, requireAllPermissions, requireScopeAccess, requireCourseAccess,
} = require('../../service/authMiddleWares');

after(async () => {
    await pool.end();
});

const USER = { id: 7, name: 'Guarded', type: 2 };
const token = (claims, options = { expiresIn: '1h' }) => jwt.sign({ ...USER, ...claims }, process.env.JWT_SECRET, options);

// A route behind `guard` that echoes what the guard attached.
const appWith = (guard) => {
    const app = express();
    app.use(express.json());
    app.post('/x', guard, (req, res) => res.json({
        reached: true, user_id: req.body.user_id, user_type: req.body.user_type, userId: req.user && req.user.id,
    }));
    return app;
};
const call = (guard, bearer) => {
    const req = request(appWith(guard)).post('/x').send({});
    return bearer === undefined ? req : req.set('Authorization', bearer);
};

const NO_TOKEN = { success: false, message: 'Authentication required', error: 'NO_TOKEN' };
const INVALID = { success: false, message: 'Invalid or expired token', error: 'INVALID_TOKEN' };
const NO_PERMISSIONS = { success: false, message: 'No permissions found in token', error: 'NO_PERMISSIONS' };
const ALLOWED = { reached: true, user_id: 7, user_type: 2, userId: 7 };

const guards = {
    requirePermission: requirePermission('a.read.all'),
    requireAnyPermission: requireAnyPermission(['a.read.all', 'b.read.all']),
    requireAllPermissions: requireAllPermissions(['a.read.all', 'b.read.all']),
    requireScopeAccess: requireScopeAccess('a', 'read'),
    requireCourseAccess: requireCourseAccess('a', 'read', () => 1),
};

for (const [name, guard] of Object.entries(guards)) {
    test(`${name}: no or empty bearer token → 401 NO_TOKEN`, async () => {
        for (const bearer of [undefined, 'Bearer', 'Bearer ']) {
            const res = await call(guard, bearer);
            assert.strictEqual(res.status, 401, String(bearer));
            assert.deepStrictEqual(res.body, NO_TOKEN);
        }
    });

    test(`${name}: bad signature, garbage or expired token → 403 INVALID_TOKEN`, async () => {
        const forged = jwt.sign({ ...USER, permissions: ['a.read.all', 'b.read.all'] }, 'wrong-secret');
        const expired = token({ permissions: ['a.read.all', 'b.read.all'] }, { expiresIn: -10 });
        for (const bad of [forged, 'not-a-jwt', expired]) {
            const res = await call(guard, `Bearer ${bad}`);
            assert.strictEqual(res.status, 403);
            assert.deepStrictEqual(res.body, INVALID);
        }
    });

    test(`${name}: token without a permissions array → 403 NO_PERMISSIONS`, async () => {
        for (const claims of [{}, { permissions: 'a.read.all' }, { permissions: null }]) {
            const res = await call(guard, `Bearer ${token(claims)}`);
            assert.strictEqual(res.status, 403, JSON.stringify(claims));
            assert.deepStrictEqual(res.body, NO_PERMISSIONS);
        }
    });

    test(`${name}: enough permissions → next() with user attached`, async () => {
        const res = await call(guard, `Bearer ${token({ permissions: ['a.read.all', 'b.read.all', 'z'] })}`);
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, ALLOWED);
    });
}

const denied = async (guard, permissions) => {
    const res = await call(guard, `Bearer ${token({ permissions })}`);
    assert.strictEqual(res.status, 403);
    return res.body;
};

test('requirePermission: missing permission → 403 naming it', async () => {
    assert.deepStrictEqual(await denied(guards.requirePermission, ['b.read.all']), {
        success: false, message: 'Permission denied: a.read.all required',
        error: 'INSUFFICIENT_PERMISSIONS', required: 'a.read.all',
    });
});

test('requireAnyPermission: one of them is enough; none → 403 listing them', async () => {
    const res = await call(guards.requireAnyPermission, `Bearer ${token({ permissions: ['b.read.all'] })}`);
    assert.deepStrictEqual(res.body, ALLOWED);
    assert.deepStrictEqual(await denied(guards.requireAnyPermission, ['c']), {
        success: false, message: 'Permission denied: One of [a.read.all, b.read.all] required',
        error: 'INSUFFICIENT_PERMISSIONS', required: ['a.read.all', 'b.read.all'],
    });
});

test('requireAllPermissions: a partial set → 403 with what is missing', async () => {
    assert.deepStrictEqual(await denied(guards.requireAllPermissions, ['b.read.all']), {
        success: false, message: 'Permission denied: Missing permissions [a.read.all]',
        error: 'INSUFFICIENT_PERMISSIONS', required: ['a.read.all', 'b.read.all'], missing: ['a.read.all'],
    });
});

test('requireScopeAccess / requireCourseAccess: only <resource>.<action>.all grants access', async () => {
    for (const guard of [guards.requireScopeAccess, guards.requireCourseAccess]) {
        assert.deepStrictEqual(await denied(guard, ['a.read.own', 'b.read.all']), {
            success: false, message: 'Permission denied: a.read.all required',
            error: 'INSUFFICIENT_PERMISSIONS', required: ['a.read.all'],
        });
    }
});

test('the guards never consult the session table (unlike authenticateUser)', async () => {
    const res = await call(guards.requirePermission, `Bearer ${token({ permissions: ['a.read.all'], sid: 'gone', type: 3 })}`);
    assert.deepStrictEqual(res.body, { ...ALLOWED, user_type: 3 });
});
