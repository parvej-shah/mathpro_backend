const Service = require('../base').Service;
const bcrypt = require('bcryptjs');
const MessagingService = require('../messagingService').MessagingService;
const { adminCredentialsEmail } = require('../emailTemplates/credentials');
const {
    isValidEmail,
    isValidPhone,
    normalizeContact
} = require('../../util/authHelpers');
const { managerialAccountTypes, SUPER_ADMIN_ROLE_NAME } = require('../../util/constants');
const logger = require('../../util/logger');

const messagingService = new MessagingService();

class AdminService extends Service {
    constructor() {
        super();
    }

    /**
     * Generate random password (alphanumeric only — easy to read/type from SMS)
     * @param {number} length - Password length (default 8)
     * @returns {string}
     */
    generatePassword = (length = 8) => {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const allChars = uppercase + lowercase + numbers;

        let password = '';
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];

        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }

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
        const emailSubject = 'Your Admin Account Credentials - Math Pro';
        const emailHTML = adminCredentialsEmail({ name, login, password });

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
            logger.error('Error in admin list:', error);
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
                logger.error('Database query error:', result.error);
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
            logger.error('Error in admin get:', error);
            return {
                success: false,
                error: 'An error occurred while fetching admin'
            };
        }
    }

    /**
     * CREATE - Create new admin
     * @param {Object} adminData - {name, type, phone, email?, profile?}
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    create = async (adminData) => {
        try {
            const { name, type, email, phone, profile } = adminData;

            // Validate required fields
            if (!name || !type || !phone) {
                return {
                    success: false,
                    error: 'Name, type, and phone are required'
                };
            }

            // Validate type (must be 1 or 2)
            if (type !== managerialAccountTypes.admin && type !== managerialAccountTypes.moderator) {
                return {
                    success: false,
                    error: 'Type must be 1 (Admin) or 2 (Moderator)'
                };
            }

            // Validate and normalize phone
            const normalizedPhone = normalizeContact(phone);
            if (!isValidPhone(normalizedPhone)) {
                return {
                    success: false,
                    error: 'Invalid phone number. Must be 11 digits starting with 01'
                };
            }

            // Validate email if provided
            let normalizedEmail = null;
            if (email) {
                normalizedEmail = normalizeContact(email);
                if (!isValidEmail(normalizedEmail)) {
                    return {
                        success: false,
                        error: 'Invalid email format'
                    };
                }
            }

            // Check if phone already exists
            const phoneCheckQuery = `SELECT id FROM managerial_auth WHERE login = $1 OR phone = $1`;
            const phoneCheckResult = await this.query(phoneCheckQuery, [normalizedPhone]);
            if (phoneCheckResult.data.length > 0) {
                return {
                    success: false,
                    error: 'Phone number already exists'
                };
            }

            // Check if email already exists (if provided)
            if (normalizedEmail) {
                const emailCheckQuery = `SELECT id FROM managerial_auth WHERE login = $1 OR email = $1`;
                const emailCheckResult = await this.query(emailCheckQuery, [normalizedEmail]);
                if (emailCheckResult.data.length > 0) {
                    return {
                        success: false,
                        error: 'Email already exists'
                    };
                }
            }

            // Generate password
            const plainPassword = this.generatePassword();
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(plainPassword, salt);

            // login = phone (primary identifier for SMS-based auth)
            const insertQuery = `
                INSERT INTO managerial_auth (
                    name, type, login, email, phone, password, profile
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, name, type, login, email, phone, profile, created_at
            `;

            const insertResult = await this.query(insertQuery, [
                name,
                type,
                normalizedPhone,
                normalizedEmail,
                normalizedPhone,
                hashedPassword,
                profile || {}
            ]);

            if (!insertResult.success) {
                return {
                    success: false,
                    error: 'Failed to create admin in database',
                    message: insertResult.error || 'Database error occurred'
                };
            }

            if (!insertResult.data || insertResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Admin creation failed - no data returned'
                };
            }

            const newAdmin = insertResult.data[0];

            // Send credentials via SMS
            const adminUrl = process.env.ADMIN_URL || 'https://admin.mathprobd.com';
            const smsText = `Math Pro Admin\nName: ${name}\nLogin: ${normalizedPhone}\nPassword: ${plainPassword}\nLogin at: ${adminUrl}/`;
            const smsResult = await messagingService.sendMessage(normalizedPhone, smsText);

            if (!smsResult.success) {
                logger.error('Failed to send credentials SMS:', smsResult.error);
                return {
                    success: true,
                    data: newAdmin,
                    password: plainPassword,
                    smsFailed: true,
                    message: 'Admin created but SMS delivery failed. Please share the password manually.'
                };
            }

            return {
                success: true,
                data: newAdmin,
                message: 'Admin created successfully. Credentials have been sent via SMS.'
            };
        } catch (error) {
            logger.error('Error in admin create:', error);
            return {
                success: false,
                error: 'An error occurred while creating admin'
            };
        }
    }

    /**
     * PROMOTE - Promote an existing regular user (type 3) to admin or moderator
     * @param {number} userId - The existing user's ID
     * @param {number} newType - Target type (1 = Admin, 2 = Moderator)
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    promote = async (userId, newType) => {
        try {
            if (!userId || !newType) {
                return { success: false, error: 'User ID and type are required' };
            }

            if (newType !== managerialAccountTypes.admin && newType !== managerialAccountTypes.moderator) {
                return { success: false, error: 'Type must be 1 (Admin) or 2 (Moderator)' };
            }

            const userResult = await this.query(
                `SELECT id, name, type, login, email, phone, profile FROM managerial_auth WHERE id = $1`,
                [userId]
            );

            if (!userResult.data || userResult.data.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const user = userResult.data[0];

            if (user.type === managerialAccountTypes.admin || user.type === managerialAccountTypes.moderator) {
                return { success: false, error: 'User is already an admin or moderator' };
            }

            const updateResult = await this.query(
                `UPDATE managerial_auth SET type = $1, updated_at = NOW() WHERE id = $2
                 RETURNING id, name, type, login, email, phone, profile, created_at, updated_at`,
                [newType, userId]
            );

            if (!updateResult.success || !updateResult.data || updateResult.data.length === 0) {
                return { success: false, error: 'Failed to promote user' };
            }

            const typeName = newType === managerialAccountTypes.admin ? 'Admin' : 'Moderator';

            if (user.phone) {
                const adminUrl = process.env.ADMIN_URL || 'https://admin.mathprobd.com';
                const smsText = `Math Pro: You have been promoted to ${typeName}. You can now access the admin panel at ${adminUrl}/`;
                const smsResult = await messagingService.sendMessage(user.phone, smsText);
                if (!smsResult.success) {
                    logger.error('Failed to send promotion SMS:', smsResult.error);
                }
            }

            return {
                success: true,
                data: updateResult.data[0],
                message: `User promoted to ${typeName} successfully`
            };
        } catch (error) {
            logger.error('Error in admin promote:', error);
            return { success: false, error: 'An error occurred while promoting user' };
        }
    }

    /**
     * SEARCH USERS - Search regular users (type 3) by phone or name for promotion
     * @param {string} query - Search term (phone number or name)
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    searchUsers = async (query) => {
        try {
            if (!query || query.trim().length < 2) {
                return { success: false, error: 'Search query must be at least 2 characters' };
            }

            const trimmed = query.trim();
            const searchQuery = `
                SELECT id, name, type, login, email, phone, created_at
                FROM managerial_auth
                WHERE type = $1
                  AND (phone ILIKE $2 OR name ILIKE $2 OR login ILIKE $2 OR email ILIKE $2)
                ORDER BY name ASC
                LIMIT 20
            `;

            const result = await this.query(searchQuery, [
                managerialAccountTypes.regular,
                `%${trimmed}%`
            ]);

            return {
                success: true,
                data: result.data || []
            };
        } catch (error) {
            logger.error('Error in searchUsers:', error);
            return { success: false, error: 'An error occurred while searching users' };
        }
    }

    /**
     * Sensitive changes (new email, new password) need the updater's own current password.
     * @returns {Promise<{success: false, error: string}|null>} the refusal, or null when allowed
     */
    currentPasswordRefusal = async (updaterId, currentPassword) => {
        if (!currentPassword) {
            return { success: false, error: 'Current password is required to update email or password' };
        }
        const updaterResult = await this.query(`SELECT password FROM managerial_auth WHERE id = $1`, [updaterId]);
        if (updaterResult.data.length === 0) {
            return { success: false, error: 'Updater not found' };
        }
        if (!await bcrypt.compare(currentPassword, updaterResult.data[0].password)) {
            return { success: false, error: 'Current password is incorrect' };
        }
        return null;
    }

    /**
     * Validated column changes for a new email: [[column, value], ...], or a refusal.
     */
    emailChange = async (id, email) => {
        const normalizedEmail = normalizeContact(email);
        if (!isValidEmail(normalizedEmail)) {
            return { refusal: { success: false, error: 'Invalid email format' } };
        }
        const taken = await this.query(`SELECT id FROM managerial_auth WHERE (login = $1 OR email = $1) AND id != $2`, [normalizedEmail, id]);
        if (taken.data.length > 0) {
            return { refusal: { success: false, error: 'Email already exists' } };
        }
        return { changes: [['login', normalizedEmail], ['email', normalizedEmail]] };
    }

    /**
     * Validated column changes for a new phone (null/'' clears it), or a refusal.
     */
    phoneChange = async (id, phone) => {
        if (phone === null || phone === '') {
            return { changes: [['phone', null]] };
        }
        const normalizedPhone = normalizeContact(phone);
        if (!isValidPhone(normalizedPhone)) {
            return { refusal: { success: false, error: 'Invalid phone number. Must be 11 digits starting with 01' } };
        }
        const taken = await this.query(`SELECT id FROM managerial_auth WHERE (login = $1 OR phone = $1) AND id != $2`, [normalizedPhone, id]);
        if (taken.data.length > 0) {
            return { refusal: { success: false, error: 'Phone number already exists' } };
        }
        return { changes: [['phone', normalizedPhone]] };
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

            const getResult = await this.get(id);
            if (!getResult.success) {
                return getResult;
            }

            // Only an ACTUAL change of email, or any password, needs the current password
            const isUpdatingEmail = email !== undefined && email !== getResult.data.email;
            const isUpdatingPassword = adminData.password !== undefined;
            if (isUpdatingEmail || isUpdatingPassword) {
                const refusal = await this.currentPasswordRefusal(updaterId, currentPassword);
                if (refusal) return refusal;
            }

            // Column changes, in the order they are validated: [[column, value], ...]
            const changes = [];
            if (name !== undefined) {
                changes.push(['name', name]);
            }
            if (type !== undefined) {
                if (type !== managerialAccountTypes.admin && type !== managerialAccountTypes.moderator) {
                    return { success: false, error: 'Type must be 1 (Admin) or 2 (Moderator)' };
                }
                changes.push(['type', type]);
            }
            if (email !== undefined) {
                const change = await this.emailChange(id, email);
                if (change.refusal) return change.refusal;
                changes.push(...change.changes);
            }
            if (phone !== undefined) {
                const change = await this.phoneChange(id, phone);
                if (change.refusal) return change.refusal;
                changes.push(...change.changes);
            }
            if (profile !== undefined) {
                // PostgreSQL JSONB accepts object directly
                changes.push(['profile', typeof profile === 'string' ? JSON.parse(profile) : profile]);
            }
            if (adminData.password !== undefined) {
                changes.push(['password', await bcrypt.hash(adminData.password, await bcrypt.genSalt(10))]);
            }

            if (changes.length === 0) {
                return { success: false, error: 'No fields to update' };
            }

            const assignments = changes.map(([column], i) => `${column} = $${i + 1}`);
            assignments.push(`updated_at = NOW()`);
            const params = [...changes.map(([, value]) => value), id];

            const updateResult = await this.query(`
                UPDATE managerial_auth 
                SET ${assignments.join(', ')}
                WHERE id = $${params.length}
                RETURNING id, name, type, login, email, phone, profile, created_at, updated_at
            `, params);

            if (!updateResult.success) {
                return {
                    success: false,
                    error: 'Failed to update admin in database',
                    message: updateResult.error || 'Database error occurred'
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
            logger.error('Error in admin update:', error);
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
                logger.error('Database query error in setPassword:', updaterResult.error);
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
                    message: updateResult.error || 'Database error occurred'
                };
            }

            if (!updateResult.data || updateResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Password update failed - no data returned',
                    message: 'Admin may not exist or update had no effect'
                };
            }

            // Send new password via SMS if admin has a phone number
            if (admin.phone) {
                const smsText = `Math Pro: Your password has been reset.\nLogin: ${admin.login}\nNew Password: ${plainPassword}`;
                const smsResult = await messagingService.sendMessage(admin.phone, smsText);
                if (!smsResult.success) {
                    logger.error('Failed to send password reset SMS:', smsResult.error);
                    return {
                        success: true,
                        data: updateResult.data[0],
                        password: plainPassword,
                        smsFailed: true,
                        message: 'Password reset but SMS delivery failed. Please share the password manually.'
                    };
                }
            } else {
                return {
                    success: true,
                    data: updateResult.data[0],
                    password: plainPassword,
                    smsFailed: true,
                    message: 'Password reset but admin has no phone number. Please share the password manually.'
                };
            }

            return {
                success: true,
                data: updateResult.data[0],
                message: 'Password has been reset and sent via SMS'
            };
        } catch (error) {
            logger.error('Error in admin setPassword:', error);
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
        try {
            return await this.withTransaction(async (client) => {
                // First verify the admin exists and lock the row
                const getQuery = `
                    SELECT id, name, email 
                    FROM managerial_auth 
                    WHERE id = $1 
                    FOR UPDATE
                `;
                const getResult = await client.query(getQuery, [id]);

                if (getResult.rows.length === 0) {
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
            });
        } catch (error) {
            return {
                success: false,
                error: 'An error occurred while deleting admin'
            };
        }
    }
}

module.exports = { AdminService };
