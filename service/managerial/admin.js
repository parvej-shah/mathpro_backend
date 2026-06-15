const Service = require('../base').Service;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const MessagingService = require('../messagingService').MessagingService;
const {
    detectContactType,
    isValidEmail,
    isValidPhone,
    normalizeContact
} = require('../../util/authHelpers');
const { managerialAccountTypes, SUPER_ADMIN_ROLE_NAME } = require('../../util/constants');

const messagingService = new MessagingService();

class AdminService extends Service {
    constructor() {
        super();
    }

    /**
     * Generate random password
     * @param {number} length - Password length (default 12)
     * @returns {string}
     */
    generatePassword = (length = 12) => {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '!@#$%^&*';
        const allChars = uppercase + lowercase + numbers + special;

        let password = '';
        // Ensure at least one of each type
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];

        // Fill the rest randomly
        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }

        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    /**
     * Send admin credentials email
     * @param {string} email - Admin email
     * @param {string} name - Admin name
     * @param {string} login - Login (email)
     * @param {string} password - Plain text password
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    sendAdminCredentialsEmail = async (email, name, login, password) => {
        const emailSubject = 'Your Admin Account Credentials - CoderVai';
        const emailHTML = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Admin Credentials</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 20px auto;
                        padding: 30px;
                        background-color: #fff;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .logo {
                        font-size: 28px;
                        font-weight: bold;
                        color: #007bff;
                    }
                    .content {
                        line-height: 1.6;
                        color: #333;
                    }
                    h1 {
                        color: #333;
                        font-size: 24px;
                        margin-bottom: 20px;
                    }
                    .credentials-box {
                        background-color: #f8f9fa;
                        border: 2px solid #007bff;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .credential-item {
                        margin: 10px 0;
                    }
                    .label {
                        font-weight: bold;
                        color: #007bff;
                    }
                    .value {
                        font-family: monospace;
                        font-size: 16px;
                        color: #333;
                        word-break: break-all;
                    }
                    .warning {
                        color: #dc3545;
                        font-size: 14px;
                        margin-top: 20px;
                        padding: 15px;
                        background-color: #fff3cd;
                        border-radius: 5px;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .footer p {
                        color: #999;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">CoderVai</div>
                    </div>
                    <div class="content">
                        <h1>Your Admin Account Has Been Created</h1>
                        <p>Hello ${name},</p>
                        <p>Your admin account has been created. Please use the following credentials to log in:</p>
                        
                        <div class="credentials-box">
                            <div class="credential-item">
                                <span class="label">Username/Email:</span><br>
                                <span class="value">${login}</span>
                            </div>
                            <div class="credential-item">
                                <span class="label">Password:</span><br>
                                <span class="value">${password}</span>
                            </div>
                        </div>
                        
                        <p>Please log in at: <a href="https://admin.codervai.com/">Admin Login</a></p>
                    </div>
                    <div class="footer">
                        <p>If you didn't expect this email, please contact the administrator immediately.</p>
                        <p>© ${new Date().getFullYear()} CoderVai. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await messagingService.sendMail(email, emailSubject, emailHTML);
    }

    /**
     * LIST - Get all admins (type 1 and 2)
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    list = async () => {
        try {
            const query = `
                SELECT 
                    id, name, type, login, email, phone, 
                    profile, created_at, updated_at
                FROM managerial_auth 
                WHERE type IN ($1, $2)
                ORDER BY created_at DESC
            `;
            const result = await this.query(query, [
                managerialAccountTypes.admin,
                managerialAccountTypes.moderator
            ]);

            return {
                success: true,
                data: result.data
            };
        } catch (error) {
            console.error('Error in admin list:', error);
            return {
                success: false,
                error: 'An error occurred while fetching admins'
            };
        }
    }

    /**
     * GET - Get single admin by ID
     * @param {number} id - Admin ID
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    get = async (id) => {
        try {
            const query = `
                SELECT 
                    id, name, type, login, email, phone, 
                    profile, created_at, updated_at
                FROM managerial_auth 
                WHERE id = $1 AND type IN ($2, $3)
            `;
            const result = await this.query(query, [
                id,
                managerialAccountTypes.admin,
                managerialAccountTypes.moderator
            ]);

            // Check if query failed
            if (!result.success) {
                console.error('Database query error:', result.error);
                return {
                    success: false,
                    error: 'An error occurred while fetching admin'
                };
            }

            // Check if admin not found
            if (!result.data || result.data.length === 0) {
                return {
                    success: false,
                    error: 'Admin not found'
                };
            }

            return {
                success: true,
                data: result.data[0]
            };
        } catch (error) {
            console.error('Error in admin get:', error);
            return {
                success: false,
                error: 'An error occurred while fetching admin'
            };
        }
    }

    /**
     * CREATE - Create new admin
     * @param {Object} adminData - {name, type, email, phone?, profile?}
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    create = async (adminData) => {
        try {
            const { name, type, email, phone, profile } = adminData;

            // Validate required fields
            if (!name || !type || !email) {
                return {
                    success: false,
                    error: 'Name, type, and email are required'
                };
            }

            // Validate type (must be 1 or 2)
            if (type !== managerialAccountTypes.admin && type !== managerialAccountTypes.moderator) {
                return {
                    success: false,
                    error: 'Type must be 1 (Admin) or 2 (Moderator)'
                };
            }

            // Validate and normalize email
            const normalizedEmail = normalizeContact(email);
            if (!isValidEmail(normalizedEmail)) {
                return {
                    success: false,
                    error: 'Invalid email format'
                };
            }

            // Validate phone if provided
            let normalizedPhone = null;
            if (phone) {
                normalizedPhone = normalizeContact(phone);
                if (!isValidPhone(normalizedPhone)) {
                    return {
                        success: false,
                        error: 'Invalid phone number. Must be 11 digits starting with 01'
                    };
                }
            }

            // Check if email already exists
            const emailCheckQuery = `SELECT id FROM managerial_auth WHERE login = $1 OR email = $1`;
            const emailCheckResult = await this.query(emailCheckQuery, [normalizedEmail]);
            if (emailCheckResult.data.length > 0) {
                return {
                    success: false,
                    error: 'Email already exists'
                };
            }

            // Check if phone already exists (if provided)
            if (normalizedPhone) {
                const phoneCheckQuery = `SELECT id FROM managerial_auth WHERE login = $1 OR phone = $1`;
                const phoneCheckResult = await this.query(phoneCheckQuery, [normalizedPhone]);
                if (phoneCheckResult.data.length > 0) {
                    return {
                        success: false,
                        error: 'Phone number already exists'
                    };
                }
            }

            // Generate password
            const plainPassword = this.generatePassword();
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(plainPassword, salt);

            // Insert admin
            const insertQuery = `
                INSERT INTO managerial_auth (
                    name, type, login, email, phone, password, profile
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, name, type, login, email, phone, profile, created_at
            `;

            const insertResult = await this.query(insertQuery, [
                name,
                type,
                normalizedEmail,
                normalizedEmail,
                normalizedPhone,
                hashedPassword,
                profile || {}
            ]);

            if (!insertResult.success) {
                return {
                    success: false,
                    error: 'Failed to create admin in database',
                    message: insertResult.error?.message || 'Database error occurred'
                };
            }

            if (!insertResult.data || insertResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Admin creation failed - no data returned'
                };
            }

            const newAdmin = insertResult.data[0];

            // Send credentials email
            const emailResult = await this.sendAdminCredentialsEmail(
                normalizedEmail,
                name,
                normalizedEmail,
                plainPassword
            );

            if (!emailResult.success) {
                console.error('Failed to send credentials email:', emailResult.error);
                // Don't fail the creation, just log the error
            }

            return {
                success: true,
                data: newAdmin,
                message: 'Admin created successfully. Credentials have been sent to email.'
            };
        } catch (error) {
            console.error('Error in admin create:', error);
            return {
                success: false,
                error: 'An error occurred while creating admin'
            };
        }
    }

    /**
     * UPDATE - Update admin
     * @param {number} id - Admin ID
     * @param {Object} adminData - {name?, type?, email?, phone?, profile?, currentPassword?}
     * @param {number} updaterId - ID of admin making the update
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    update = async (id, adminData, updaterId) => {
        try {
            const { name, type, email, phone, profile, currentPassword } = adminData;

            // Get current admin
            const getResult = await this.get(id);
            if (!getResult.success) {
                return getResult;
            }
            const currentAdmin = getResult.data;

            // If updating email/login or password, require current password
            // Only require password if email or password is ACTUALLY CHANGING
            const isUpdatingEmail = email !== undefined && email !== currentAdmin.email;
            const isUpdatingPassword = adminData.password !== undefined;

            if ((isUpdatingEmail || isUpdatingPassword) && currentPassword) {
                // Get updater's password to verify
                const updaterQuery = `SELECT password FROM managerial_auth WHERE id = $1`;
                const updaterResult = await this.query(updaterQuery, [updaterId]);

                if (updaterResult.data.length === 0) {
                    return {
                        success: false,
                        error: 'Updater not found'
                    };
                }

                const isPasswordValid = await bcrypt.compare(
                    currentPassword,
                    updaterResult.data[0].password
                );

                if (!isPasswordValid) {
                    return {
                        success: false,
                        error: 'Current password is incorrect'
                    };
                }
            } else if (isUpdatingEmail || isUpdatingPassword) {
                return {
                    success: false,
                    error: 'Current password is required to update email or password'
                };
            }

            // Build update query dynamically
            const updates = [];
            const params = [];
            let paramIndex = 1;

            if (name !== undefined) {
                updates.push(`name = $${paramIndex++}`);
                params.push(name);
            }

            if (type !== undefined) {
                if (type !== managerialAccountTypes.admin && type !== managerialAccountTypes.moderator) {
                    return {
                        success: false,
                        error: 'Type must be 1 (Admin) or 2 (Moderator)'
                    };
                }
                updates.push(`type = $${paramIndex++}`);
                params.push(type);
            }

            if (email !== undefined) {
                const normalizedEmail = normalizeContact(email);
                if (!isValidEmail(normalizedEmail)) {
                    return {
                        success: false,
                        error: 'Invalid email format'
                    };
                }

                // Check if email already exists (excluding current admin)
                const emailCheckQuery = `SELECT id FROM managerial_auth WHERE (login = $1 OR email = $1) AND id != $2`;
                const emailCheckResult = await this.query(emailCheckQuery, [normalizedEmail, id]);
                if (emailCheckResult.data.length > 0) {
                    return {
                        success: false,
                        error: 'Email already exists'
                    };
                }

                updates.push(`login = $${paramIndex++}`);
                updates.push(`email = $${paramIndex++}`);
                params.push(normalizedEmail, normalizedEmail);
            }

            if (phone !== undefined) {
                if (phone === null || phone === '') {
                    updates.push(`phone = NULL`);
                } else {
                    const normalizedPhone = normalizeContact(phone);
                    if (!isValidPhone(normalizedPhone)) {
                        return {
                            success: false,
                            error: 'Invalid phone number. Must be 11 digits starting with 01'
                        };
                    }

                    // Check if phone already exists (excluding current admin)
                    const phoneCheckQuery = `SELECT id FROM managerial_auth WHERE (login = $1 OR phone = $1) AND id != $2`;
                    const phoneCheckResult = await this.query(phoneCheckQuery, [normalizedPhone, id]);
                    if (phoneCheckResult.data.length > 0) {
                        return {
                            success: false,
                            error: 'Phone number already exists'
                        };
                    }

                    updates.push(`phone = $${paramIndex++}`);
                    params.push(normalizedPhone);
                }
            }

            if (profile !== undefined) {
                updates.push(`profile = $${paramIndex++}`);
                // PostgreSQL JSONB accepts object directly
                params.push(typeof profile === 'string' ? JSON.parse(profile) : profile);
            }

            if (adminData.password !== undefined) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(adminData.password, salt);
                updates.push(`password = $${paramIndex++}`);
                params.push(hashedPassword);
            }

            if (updates.length === 0) {
                return {
                    success: false,
                    error: 'No fields to update'
                };
            }

            updates.push(`updated_at = NOW()`);
            params.push(id);

            const updateQuery = `
                UPDATE managerial_auth 
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING id, name, type, login, email, phone, profile, created_at, updated_at
            `;

            const updateResult = await this.query(updateQuery, params);

            if (!updateResult.success) {
                return {
                    success: false,
                    error: 'Failed to update admin in database',
                    message: updateResult.error?.message || 'Database error occurred'
                };
            }

            if (!updateResult.data || updateResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Admin update failed - no data returned',
                    message: 'Admin may not exist or update had no effect'
                };
            }

            return {
                success: true,
                data: updateResult.data[0],
                message: 'Admin updated successfully'
            };
        } catch (error) {
            console.error('Error in admin update:', error);
            return {
                success: false,
                error: 'An error occurred while updating admin'
            };
        }
    }

    /**
     * SET PASSWORD - Set/reset admin password
     * @param {number} id - Admin ID
     * @param {number} updaterId - ID of admin setting the password
     * @param {string} currentPassword - Current password of updater
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    setPassword = async (id, updaterId, currentPassword) => {
        try {
            // Verify updater's password
            const updaterQuery = `SELECT password FROM managerial_auth WHERE id = $1`;
            const updaterResult = await this.query(updaterQuery, [updaterId]);

            // Check if query failed
            if (!updaterResult.success) {
                console.error('Database query error in setPassword:', updaterResult.error);
                return {
                    success: false,
                    error: 'An error occurred while verifying credentials'
                };
            }

            if (!updaterResult.data || updaterResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Updater not found'
                };
            }

            const isPasswordValid = await bcrypt.compare(
                currentPassword,
                updaterResult.data[0].password
            );

            if (!isPasswordValid) {
                return {
                    success: false,
                    error: 'Current password is incorrect'
                };
            }

            // Get admin to set password for
            const getResult = await this.get(id);
            if (!getResult.success) {
                return getResult;
            }
            const admin = getResult.data;

            // Generate new password
            const plainPassword = this.generatePassword();
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(plainPassword, salt);

            // Update password
            const updateQuery = `
                UPDATE managerial_auth 
                SET password = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, email, login
            `;
            const updateResult = await this.query(updateQuery, [hashedPassword, id]);

            if (!updateResult.success) {
                return {
                    success: false,
                    error: 'Failed to update password in database',
                    message: updateResult.error?.message || 'Database error occurred'
                };
            }

            if (!updateResult.data || updateResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Password update failed - no data returned',
                    message: 'Admin may not exist or update had no effect'
                };
            }

            // Send credentials email
            const emailResult = await this.sendAdminCredentialsEmail(
                admin.email || admin.login,
                admin.name,
                admin.login,
                plainPassword
            );

            if (!emailResult.success) {
                console.error('Failed to send credentials email:', emailResult.error);
                // Don't fail the operation, just log the error
            }

            return {
                success: true,
                data: updateResult.data[0],
                message: 'Password has been reset and sent to admin email'
            };
        } catch (error) {
            console.error('Error in admin setPassword:', error);
            return {
                success: false,
                error: 'An error occurred while setting password'
            };
        }
    }

    /**
     * DELETE - Delete admin
     * @param {number} id - Admin ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    delete = async (id) => {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');

            // First verify the admin exists and lock the row
            const getQuery = `
                SELECT id, name, email 
                FROM managerial_auth 
                WHERE id = $1 
                FOR UPDATE
            `;
            const getResult = await client.query(getQuery, [id]);

            if (getResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'Admin not found'
                };
            }

            // Prevent deleting the last super admin (role-based: applies to any admin or moderator with super_admin role)
            const superAdminRoleResult = await client.query(
                'SELECT id FROM roles WHERE name = $1',
                [SUPER_ADMIN_ROLE_NAME]
            );
            if (superAdminRoleResult.rows.length > 0) {
                const superAdminRoleId = superAdminRoleResult.rows[0].id;
                // Lock user_roles rows for this role so count is stable (prevents TOCTOU with role removal)
                await client.query(
                    'SELECT user_id, role_id FROM user_roles WHERE role_id = $1 FOR UPDATE',
                    [superAdminRoleId]
                );
                const countResult = await client.query(
                    'SELECT COUNT(*)::int AS count FROM user_roles WHERE role_id = $1',
                    [superAdminRoleId]
                );
                const superAdminCount = parseInt(countResult.rows[0].count, 10);
                const thisUserHasSuperAdmin = await client.query(
                    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2',
                    [id, superAdminRoleId]
                );
                if (superAdminCount <= 1 && thisUserHasSuperAdmin.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return {
                        success: false,
                        error: 'Cannot delete the last super admin. At least one user must have the super admin role.'
                    };
                }
            }

            // Atomic check: Lock all admin/moderator rows to prevent concurrent deletions (type-based fallback)
            await client.query(`
                SELECT id FROM managerial_auth 
                WHERE type IN ($1, $2) 
                FOR UPDATE
            `, [
                managerialAccountTypes.admin,
                managerialAccountTypes.moderator
            ]);
            const countResult = await client.query(`
                SELECT COUNT(*)::integer as count 
                FROM managerial_auth 
                WHERE type IN ($1, $2)
            `, [
                managerialAccountTypes.admin,
                managerialAccountTypes.moderator
            ]);

            const adminCount = parseInt(countResult.rows[0].count);
            if (adminCount <= 1) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'Cannot delete the last admin or moderator'
                };
            }

            // Delete admin (we know it exists and count > 1)
            const deleteQuery = `
                DELETE FROM managerial_auth 
                WHERE id = $1
                RETURNING id, name, email
            `;
            const deleteResult = await client.query(deleteQuery, [id]);

            await client.query('COMMIT');

            if (deleteResult.rows.length === 0) {
                // This shouldn't happen since we verified existence above
                return {
                    success: false,
                    error: 'Admin deletion failed'
                };
            }

            return {
                success: true,
                message: 'Admin deleted successfully'
            };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => { });
            console.error('Error in admin delete:', error);
            return {
                success: false,
                error: 'An error occurred while deleting admin'
            };
        } finally {
            client.release();
        }
    }
}

module.exports = { AdminService };
