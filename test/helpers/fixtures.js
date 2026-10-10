// Minimal deterministic seed data + JWTs mirroring AuthService.buildTokenObject.
const jwt = require('jsonwebtoken');
const { pool } = require('../../service/base');
const { ALL_PERMISSIONS } = require('../../util/permissions');
const { SUPER_ADMIN_ROLE_NAME } = require('../../util/constants');

const ADMIN = { id: 1, name: 'Test Admin', type: 1, login: 'admin@test.local' };
const STUDENT = { id: 2, name: 'Test Student', type: 3, login: '01700000000' };
const COURSE_ID = 1;

async function seed() {
    await pool.query(`
        INSERT INTO managerial_auth (id, name, type, login, password, email, phone, profile) VALUES
            (1, 'Test Admin', 1, 'admin@test.local', 'x', 'admin@test.local', NULL, '{}'),
            (2, 'Test Student', 3, '01700000000', 'x', NULL, '01700000000', '{}')
        ON CONFLICT (id) DO NOTHING;
        SELECT setval('managerial_auth_id_seq', 100);

        INSERT INTO roles (id, name, display_name) VALUES (1, '${SUPER_ADMIN_ROLE_NAME}', 'Super Admin')
        ON CONFLICT DO NOTHING;
        INSERT INTO user_roles (user_id, role_id) VALUES (1, 1) ON CONFLICT DO NOTHING;

        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free)
        VALUES (1, 'Test Course', 1000, 1500, true, true, 1, 'test-course', 'test-course', '[]', false)
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO chapter (id, course_id, title, serial, is_live, is_free) VALUES (1, 1, 'Chapter 1', 1, true, true)
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO module (id, chapter_id, title, serial, is_live, is_free, data, metadata)
        VALUES (1, 1, 'Module 1', 1, true, true, '{}', '{}') ON CONFLICT (id) DO NOTHING;
        INSERT INTO bundle (id, title, price, is_live, is_active) VALUES (1, 'Test Bundle', 900, true, true)
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO bundle_course (bundle_id, course_id) VALUES (1, 1) ON CONFLICT DO NOTHING;
    `);
}

const sign = (user, roles, permissions) => jwt.sign(
    { ...user, profile: {}, roles, permissions, createdAt: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
);

const adminToken = () => sign(ADMIN, [SUPER_ADMIN_ROLE_NAME], ALL_PERMISSIONS);
// Sid-less student token: allowed through by isSessionActive (legacy-token path).
const studentToken = () => sign(STUDENT, [], []);

module.exports = { ADMIN, STUDENT, COURSE_ID, seed, sign, adminToken, studentToken, pool };
