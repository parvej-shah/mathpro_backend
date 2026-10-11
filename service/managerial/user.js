const Service = require('../base').Service;
const bcrypt = require('bcryptjs');
const MessagingService = require('../messagingService').MessagingService;
const { userCredentialsEmail } = require('../emailTemplates/credentials');
const {
    isValidEmail,
    isValidPhone,
    normalizeContact
} = require('../../util/authHelpers');
const { managerialAccountTypes } = require('../../util/constants');
const logger = require('../../util/logger');
const { buildUpdate } = require('../../util/buildUpdate');
const { pageMeta } = require('../../util/pagination');

const messagingService = new MessagingService();

class UserService extends Service {
    constructor() {
        super();
    }

    /**
     * Generate random password
     * @param {number} length - Password length (default 12)
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
     * Send user credentials email/SMS
     * @param {string} contact - User email or phone
     * @param {string} name - User name
     * @param {string} login - Login credential
     * @param {string} password - Password
     * @param {string} contactType - 'email' or 'phone'
     * @param {string} purpose - 'creation' or 'reset' (default: 'creation')
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    sendUserCredentials = async (contact, name, login, password, contactType, purpose = 'creation') => {
        if (contactType === 'email') {
            const isCreation = purpose === 'creation';
            const emailSubject = isCreation
                ? '🎉 Welcome to Math Pro - Your Account Credentials'
                : '🔐 Your Password Has Been Reset - Math Pro';

            const emailHTML = userCredentialsEmail({ isCreation, name, login, password });

            return await messagingService.sendMail(contact, emailSubject, emailHTML);
        } else {
            // Send SMS
            const isCreation = purpose === 'creation';
            const message = isCreation
                ? `Math Pro: Your account has been created! Login: ${login}, Password: ${password}. Please change your password after first login. Visit: mathpro.com/login`
                : `Math Pro: Your password has been reset. Login: ${login}, New Password: ${password}. Please login and change your password immediately. Visit: mathpro.com/login`;
            return await messagingService.sendMessage(contact, message);
        }
    }

    /**
     * LIST - Get all regular users (type=3) with filtering and pagination
     * @param {Object} filters - {status, search, dateFrom, dateTo}
     * @param {Object} pagination - {page, limit, sortBy, sortOrder}
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    listUsers = async (filters = {}, pagination = {}) => {
        try {
            const {
                status, // 'active', 'inactive', 'all'
                search, // search in name, email, phone
                dateFrom,
                dateTo
            } = filters;

            const {
                page = 1,
                limit = 20,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = pagination;

            // Build WHERE conditions
            const conditions = ['type = $1']; // Only regular users
            const params = [managerialAccountTypes.regular];
            let paramIndex = 2;

            // Status filter
            if (status === 'active') {
                // Active users are those where deleted is null or false
                conditions.push(`(profile->>'deleted' IS NULL OR profile->>'deleted' = 'false')`);
            } else if (status === 'inactive') {
                // Inactive users are those where deleted is true
                conditions.push(`profile->>'deleted' = 'true'`);
            }

            // Search filter
            if (search) {
                conditions.push(`(
                    name ILIKE $${paramIndex} OR 
                    email ILIKE $${paramIndex} OR 
                    phone ILIKE $${paramIndex} OR
                    login ILIKE $${paramIndex}
                )`);
                params.push(`%${search}%`);
                paramIndex++;
            }

            // Date range filter
            if (dateFrom) {
                conditions.push(`created_at >= $${paramIndex}`);
                params.push(dateFrom);
                paramIndex++;
            }
            if (dateTo) {
                conditions.push(`created_at <= $${paramIndex}`);
                params.push(dateTo);
                paramIndex++;
            }

            // Count total records
            const countQuery = `
                SELECT COUNT(*)::integer as total
                FROM managerial_auth
                WHERE ${conditions.join(' AND ')}
            `;
            const countResult = await this.query(countQuery, params);
            const total = countResult.data[0].total;

            // Calculate pagination
            const offset = (page - 1) * limit;

            // Fetch users
            const validSortColumns = ['created_at', 'updated_at', 'name', 'email', 'phone'];
            const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
            const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            const query = `
                SELECT 
                    id, name, type, login, email, phone,
                    profile, created_at, updated_at
                FROM managerial_auth
                WHERE ${conditions.join(' AND ')}
                ORDER BY ${sortColumn} ${order}
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;
            params.push(limit, offset);

            const result = await this.query(query, params);
            const meta = pageMeta(page, limit, total);

            return {
                success: true,
                data: {
                    users: result.data,
                    pagination: { ...meta, hasMore: page < meta.totalPages }
                }
            };
        } catch (error) {
            logger.error('Error in user list:', error);
            return {
                success: false,
                error: 'An error occurred while fetching users'
            };
        }
    }

    /**
     * GET - Get user details with enrollment data
     * @param {number} userId - User ID
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    getUserDetails = async (userId) => {
        try {
            // Get user basic info
            const userQuery = `
                SELECT 
                    id, name, type, login, email, phone,
                    profile, created_at, updated_at
                FROM managerial_auth
                WHERE id = $1 AND type = $2
            `;
            const userResult = await this.query(userQuery, [userId, managerialAccountTypes.regular]);

            if (!userResult.success || !userResult.data || userResult.data.length === 0) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            const user = userResult.data[0];

            // Get enrollment summary (optional - won't fail if tables don't exist)
            let enrollment = { courses: 0, bundles: 0 };
            try {
                const enrollmentQuery = `
                    SELECT 
                        COUNT(DISTINCT CASE WHEN item_type = 'course' THEN item_id END)::integer as course_count,
                        COUNT(DISTINCT CASE WHEN item_type = 'bundle' THEN item_id END)::integer as bundle_count
                    FROM purchase
                    WHERE user_id = $1 AND status = 'completed'
                `;
                const enrollmentResult = await this.query(enrollmentQuery, [userId]);
                if (enrollmentResult.success && enrollmentResult.data && enrollmentResult.data.length > 0) {
                    enrollment = {
                        courses: enrollmentResult.data[0]?.course_count || 0,
                        bundles: enrollmentResult.data[0]?.bundle_count || 0
                    };
                }
            } catch (err) {
                // Silently skip - purchase table may not exist yet
            }

            return {
                success: true,
                data: {
                    ...user,
                    enrollment
                }
            };
        } catch (error) {
            logger.error('Error in getUserDetails:', error);
            return {
                success: false,
                error: 'An error occurred while fetching user details'
            };
        }
    }

    /**
     * GET - Get aggregated user history for admin dashboard
     * Includes purchases, progress, feedbacks, module feedbacks, and submissions.
     * @param {number} userId
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    getUserHistory = async (userId) => {
        try {
            const userResult = await this.query(
                `SELECT id, name, type, login, email, phone, created_at, updated_at
                 FROM managerial_auth
                 WHERE id = $1 AND type = $2`,
                [userId, managerialAccountTypes.regular]
            );

            if (!userResult.success || !userResult.data || userResult.data.length === 0) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            const user = userResult.data[0];

            const purchasesPromise = this.query(
                `SELECT
                    t.user_id,
                    t.course_id as item_id,
                    'course'::text as item_type,
                    t.amount,
                    t.coupon_id,
                    t.transaction_id,
                    t.timestamp as purchased_at,
                    c.title as course_title,
                    NULL::text as bundle_title
                FROM takes t
                LEFT JOIN course c ON t.course_id = c.id
                WHERE t.user_id = $1
                UNION ALL
                SELECT
                    bp.user_id,
                    bp.bundle_id as item_id,
                    'bundle'::text as item_type,
                    bp.amount,
                    bp.coupon_id,
                    bp.transaction_id,
                    bp.timestamp as purchased_at,
                    NULL::text as course_title,
                    b.title as bundle_title
                FROM bundle_purchase bp
                LEFT JOIN bundle b ON bp.bundle_id = b.id
                WHERE bp.user_id = $1
                ORDER BY purchased_at DESC NULLS LAST`,
                [userId]
            );

            const progressPromise = this.query(
                `SELECT
                    p.user_id,
                    p.module_id,
                    p.point,
                    p.timestamp,
                    m.title as module_title,
                    m.serial as module_serial,
                    ch.id as chapter_id,
                    ch.title as chapter_title,
                    c.id as course_id,
                    c.title as course_title
                FROM progress p
                LEFT JOIN module m ON p.module_id = m.id
                LEFT JOIN chapter ch ON m.chapter_id = ch.id
                LEFT JOIN course c ON ch.course_id = c.id
                WHERE p.user_id = $1
                ORDER BY p.timestamp DESC`,
                [userId]
            );

            const feedbackPromise = this.query(
                `SELECT
                    f.id,
                    f.user_id,
                    f.course_id,
                    f.rating,
                    f.comment,
                    f.category,
                    f.created_at,
                    f.updated_at,
                    c.title as course_title
                FROM feedbacks f
                LEFT JOIN course c ON c.id::text = f.course_id
                WHERE f.user_id = $1::text
                ORDER BY f.created_at DESC`,
                [userId]
            );

            const moduleFeedbackPromise = this.query(
                `SELECT
                    mf.id,
                    mf.user_id,
                    mf.module_id,
                    mf.reaction,
                    mf.reason,
                    mf.comment,
                    mf.created_at,
                    mf.updated_at,
                    m.title as module_title,
                    ch.id as chapter_id,
                    ch.title as chapter_title,
                    c.id as course_id,
                    c.title as course_title
                FROM module_feedback mf
                LEFT JOIN module m ON mf.module_id = m.id
                LEFT JOIN chapter ch ON m.chapter_id = ch.id
                LEFT JOIN course c ON ch.course_id = c.id
                WHERE mf.user_id = $1
                ORDER BY mf.created_at DESC`,
                [userId]
            );

            const [purchases, progress, feedbacks, moduleFeedbacks] = await Promise.all([
                purchasesPromise,
                progressPromise,
                feedbackPromise,
                moduleFeedbackPromise
            ]);

            return {
                success: true,
                data: {
                    user,
                    summary: {
                        purchases: purchases.success ? purchases.data.length : 0,
                        progress_entries: progress.success ? progress.data.length : 0,
                        feedbacks: feedbacks.success ? feedbacks.data.length : 0,
                        module_feedbacks: moduleFeedbacks.success ? moduleFeedbacks.data.length : 0
                    },
                    purchases: purchases.success ? purchases.data : [],
                    progress: progress.success ? progress.data : [],
                    feedbacks: feedbacks.success ? feedbacks.data : [],
                    module_feedbacks: moduleFeedbacks.success ? moduleFeedbacks.data : []
                }
            };
        } catch (error) {
            logger.error('Error in getUserHistory:', error);
            return {
                success: false,
                error: 'An error occurred while fetching user history'
            };
        }
    }

    /**
     * Get student course access from takes table
     * @param {number} userId
     */
    getStudentCourseAccess = async (userId) => {
        try {
            const userCheck = await this.query(
                `SELECT id, name, type FROM managerial_auth WHERE id = $1`,
                [userId]
            );
            if (!userCheck.success || !userCheck.data || userCheck.data.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const result = await this.query(
                `SELECT DISTINCT ON (t.course_id)
                    t.user_id,
                    t.course_id,
                    c.title as course_title,
                    t.amount,
                    t.transaction_id,
                    t.coupon_id,
                    t.timestamp as enrolled_at
                 FROM takes t
                 LEFT JOIN course c ON c.id = t.course_id
                 WHERE t.user_id = $1
                 ORDER BY t.course_id, t.timestamp DESC NULLS LAST`,
                [userId]
            );

            return result.success
                ? { success: true, data: result.data }
                : { success: false, error: 'Failed to fetch student course access' };
        } catch (error) {
            logger.error('Error in getStudentCourseAccess:', error);
            return { success: false, error: 'Failed to fetch student course access' };
        }
    }

    getStudentBundleAccess = async (userId) => {
        try {
            const userCheck = await this.query(
                `SELECT id, name, type FROM managerial_auth WHERE id = $1`,
                [userId]
            );
            if (!userCheck.success || !userCheck.data || userCheck.data.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const result = await this.query(
                `SELECT
                    bp.id as bundle_access_id,
                    bp.user_id,
                    bp.bundle_id,
                    b.title as bundle_title,
                    bp.amount,
                    bp.transaction_id,
                    bp.coupon_id,
                    bp.timestamp as enrolled_at
                 FROM bundle_purchase bp
                 LEFT JOIN bundle b ON b.id = bp.bundle_id
                 WHERE bp.user_id = $1
                 ORDER BY bp.timestamp DESC NULLS LAST, bp.id DESC`,
                [userId]
            );

            return result.success
                ? { success: true, data: result.data }
                : { success: false, error: 'Failed to fetch student bundle access' };
        } catch (error) {
            logger.error('Error in getStudentBundleAccess:', error);
            return { success: false, error: 'Failed to fetch student bundle access' };
        }
    }

    /**
     * Grant student course access by inserting into takes table
     * @param {number} userId
     * @param {number} courseId
     */
    grantStudentCourseAccess = async (userId, courseId) => {
        try {
            const [userCheck, courseCheck] = await Promise.all([
                this.query(`SELECT id, type, name FROM managerial_auth WHERE id = $1`, [userId]),
                this.query(`SELECT id, title FROM course WHERE id = $1`, [courseId])
            ]);

            if (!userCheck.success || userCheck.data.length === 0) {
                return { success: false, error: 'User not found' };
            }
            if (userCheck.data[0].type !== managerialAccountTypes.regular) {
                return { success: false, error: 'Target user is not a student (type 3)' };
            }
            if (!courseCheck.success || courseCheck.data.length === 0) {
                return { success: false, error: 'Course not found' };
            }

            const existing = await this.query(
                `SELECT 1 FROM takes WHERE user_id = $1 AND course_id = $2 LIMIT 1`,
                [userId, courseId]
            );
            if (existing.success && existing.data.length > 0) {
                return { success: false, error: 'Student already has access to this course' };
            }

            const insertResult = await this.query(
                `INSERT INTO takes (user_id, course_id, amount, transaction_id, timestamp)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING user_id, course_id, amount, transaction_id, timestamp`,
                [userId, courseId, 0, null, parseInt(Date.now() / 1000)]
            );

            if (!insertResult.success || !insertResult.data || insertResult.data.length === 0) {
                return { success: false, error: 'Failed to grant course access' };
            }

            return {
                success: true,
                data: {
                    ...insertResult.data[0],
                    course: courseCheck.data[0],
                    user: userCheck.data[0]
                }
            };
        } catch (error) {
            logger.error('Error in grantStudentCourseAccess:', error);
            return { success: false, error: 'Failed to grant course access' };
        }
    }

    grantStudentBundleAccess = async (userId, bundleId) => {
        try {
            const [userCheck, bundleCheck] = await Promise.all([
                this.query(`SELECT id, type, name FROM managerial_auth WHERE id = $1`, [userId]),
                this.query(`SELECT id, title FROM bundle WHERE id = $1`, [bundleId])
            ]);

            if (!userCheck.success || userCheck.data.length === 0) {
                return { success: false, error: 'User not found' };
            }
            if (userCheck.data[0].type !== managerialAccountTypes.regular) {
                return { success: false, error: 'Target user is not a student (type 3)' };
            }
            if (!bundleCheck.success || bundleCheck.data.length === 0) {
                return { success: false, error: 'Bundle not found' };
            }

            const existing = await this.query(
                `SELECT 1 FROM bundle_purchase WHERE user_id = $1 AND bundle_id = $2 LIMIT 1`,
                [userId, bundleId]
            );
            if (existing.success && existing.data.length > 0) {
                return { success: false, error: 'Student already has access to this bundle' };
            }

            const bundleInsert = await this.query(
                `INSERT INTO bundle_purchase (user_id, bundle_id, amount, transaction_id, timestamp, coupon_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, user_id, bundle_id, amount, transaction_id, timestamp`,
                [userId, bundleId, 0, null, parseInt(Date.now() / 1000), null]
            );
            if (!bundleInsert.success || !bundleInsert.data || bundleInsert.data.length === 0) {
                return { success: false, error: 'Failed to grant bundle access' };
            }

            const bundleCourses = await this.query(
                `SELECT course_id FROM bundle_course WHERE bundle_id = $1`,
                [bundleId]
            );

            let grantedCourses = 0;
            if (bundleCourses.success && bundleCourses.data.length > 0) {
                for (const row of bundleCourses.data) {
                    const courseId = row.course_id;
                    const hasCourse = await this.query(
                        `SELECT 1 FROM takes WHERE user_id = $1 AND course_id = $2 LIMIT 1`,
                        [userId, courseId]
                    );
                    if (hasCourse.success && hasCourse.data.length === 0) {
                        const enroll = await this.query(
                            `INSERT INTO takes (user_id, course_id, amount, transaction_id, timestamp)
                             VALUES ($1, $2, $3, $4, $5)`,
                            [userId, courseId, 0, null, parseInt(Date.now() / 1000)]
                        );
                        if (enroll.success) grantedCourses += 1;
                    }
                }
            }

            return {
                success: true,
                data: {
                    ...bundleInsert.data[0],
                    bundle: bundleCheck.data[0],
                    user: userCheck.data[0],
                    granted_courses_from_bundle: grantedCourses
                }
            };
        } catch (error) {
            logger.error('Error in grantStudentBundleAccess:', error);
            return { success: false, error: 'Failed to grant bundle access' };
        }
    }

    /**
     * Revoke student course access by deleting from takes table
     * @param {number} userId
     * @param {number} courseId
     */
    revokeStudentCourseAccess = async (userId, courseId) => {
        try {
            const existing = await this.query(
                `SELECT user_id, course_id FROM takes WHERE user_id = $1 AND course_id = $2`,
                [userId, courseId]
            );
            if (!existing.success || existing.data.length === 0) {
                return { success: false, error: 'Student course access not found' };
            }

            const remove = await this.query(
                `DELETE FROM takes WHERE user_id = $1 AND course_id = $2`,
                [userId, courseId]
            );

            if (!remove.success) {
                return { success: false, error: 'Failed to revoke course access' };
            }

            return {
                success: true,
                data: {
                    user_id: userId,
                    course_id: courseId,
                    removed_rows: existing.data.length
                }
            };
        } catch (error) {
            logger.error('Error in revokeStudentCourseAccess:', error);
            return { success: false, error: 'Failed to revoke course access' };
        }
    }

    revokeStudentBundleAccess = async (userId, bundleId) => {
        try {
            const existing = await this.query(
                `SELECT id FROM bundle_purchase WHERE user_id = $1 AND bundle_id = $2`,
                [userId, bundleId]
            );
            if (!existing.success || existing.data.length === 0) {
                return { success: false, error: 'Student bundle access not found' };
            }

            const remove = await this.query(
                `DELETE FROM bundle_purchase WHERE user_id = $1 AND bundle_id = $2`,
                [userId, bundleId]
            );
            if (!remove.success) {
                return { success: false, error: 'Failed to revoke bundle access' };
            }

            return {
                success: true,
                data: {
                    user_id: userId,
                    bundle_id: bundleId,
                    removed_rows: existing.data.length
                }
            };
        } catch (error) {
            logger.error('Error in revokeStudentBundleAccess:', error);
            return { success: false, error: 'Failed to revoke bundle access' };
        }
    }

    /**
     * CREATE - Create new regular user
     * @param {Object} userData - {name, email, phone?, profile?}
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    createUser = async (userData) => {
        try {
            const { name, email, phone, profile } = userData;

            // Validate required fields
            if (!name) {
                return {
                    success: false,
                    error: 'Name is required'
                };
            }

            if (!email) {
                return {
                    success: false,
                    error: 'Email is required'
                };
            }

            let normalizedEmail = null;
            let normalizedPhone = null;

            normalizedEmail = normalizeContact(email);
            if (!isValidEmail(normalizedEmail)) {
                return {
                    success: false,
                    error: 'Invalid email format'
                };
            }

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

            // Check if phone already exists
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

            // Insert user
            const insertQuery = `
                INSERT INTO managerial_auth (
                    name, type, login, email, phone, password, profile
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, name, type, login, email, phone, profile, created_at
            `;

            const insertResult = await this.query(insertQuery, [
                name,
                managerialAccountTypes.regular,
                normalizedEmail,
                normalizedEmail,
                normalizedPhone,
                hashedPassword,
                profile || {}
            ]);

            if (!insertResult.success || !insertResult.data || insertResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Failed to create user in database'
                };
            }

            const newUser = insertResult.data[0];

            // Send credentials
            const contactToSend = normalizedEmail || normalizedPhone;
            const credentialsResult = await this.sendUserCredentials(
                contactToSend,
                name,
                normalizedEmail,
                plainPassword,
                normalizedEmail ? 'email' : 'phone'
            );

            if (!credentialsResult.success) {
                logger.error('Failed to send credentials:', credentialsResult.error);
                // Don't fail the creation, just log the error
                // TODO: Send notification to admin
            }

            return {
                success: true,
                data: newUser,
                message: 'User created successfully. Credentials have been sent.'
            };
        } catch (error) {
            logger.error('Error in createUser:', error);
            return {
                success: false,
                error: 'An error occurred while creating user'
            };
        }
    }

    /**
     * UPDATE - Update user information
     * @param {number} userId - User ID
     * @param {Object} userData - {name?, email?, phone?, profile?}
     * @param {number} adminId - ID of admin making the update
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    updateUser = async (userId, userData, adminId) => {
        try {
            const { name, email, phone, profile } = userData;

            // Get current user
            const getUserResult = await this.getUserDetails(userId);
            if (!getUserResult.success) {
                return getUserResult;
            }

            const currentUser = getUserResult.data;

            // Determine effective final state for email and phone
            let effectiveEmail = email !== undefined ? email : currentUser.email;
            let effectivePhone = phone !== undefined ? phone : currentUser.phone;

            // Normalize the effective values
            let normalizedEmail = null;
            let normalizedPhone = null;

            if (effectiveEmail) {
                normalizedEmail = normalizeContact(effectiveEmail);
                if (!isValidEmail(normalizedEmail)) {
                    return {
                        success: false,
                        error: 'Invalid email format'
                    };
                }
            }

            if (effectivePhone && effectivePhone !== null && effectivePhone !== '') {
                normalizedPhone = normalizeContact(effectivePhone);
                if (!isValidPhone(normalizedPhone)) {
                    return {
                        success: false,
                        error: 'Invalid phone number. Must be 11 digits starting with 01'
                    };
                }
            }

            if (!normalizedEmail) {
                return {
                    success: false,
                    error: 'Email is required and must be valid'
                };
            }
            const calculatedLogin = normalizedEmail;

            // Columns to update, collected in the order the checks below run
            const patch = {};

            if (name !== undefined) {
                patch.name = name;
            }

            if (email !== undefined) {
                // Check if email already exists (excluding current user)
                const emailCheckQuery = `SELECT id FROM managerial_auth WHERE (login = $1 OR email = $1) AND id != $2`;
                const emailCheckResult = await this.query(emailCheckQuery, [normalizedEmail, userId]);
                if (emailCheckResult.data.length > 0) {
                    return {
                        success: false,
                        error: 'Email already exists'
                    };
                }

                patch.email = normalizedEmail;
            }

            if (phone !== undefined) {
                if (phone === null || phone === '') {
                    patch.phone = null;
                } else {
                    // Check if phone already exists (excluding current user)
                    const phoneCheckQuery = `SELECT id FROM managerial_auth WHERE (login = $1 OR phone = $1) AND id != $2`;
                    const phoneCheckResult = await this.query(phoneCheckQuery, [normalizedPhone, userId]);
                    if (phoneCheckResult.data.length > 0) {
                        return {
                            success: false,
                            error: 'Phone number already exists'
                        };
                    }

                    patch.phone = normalizedPhone;
                }
            }

            if (profile !== undefined) {
                patch.profile = typeof profile === 'string' ? JSON.parse(profile) : profile;
            }

            // Always update login to match email
            if (calculatedLogin !== currentUser.login) {
                // Check if the calculated login already exists (excluding current user)
                const loginCheckQuery = `SELECT id FROM managerial_auth WHERE (login = $1 OR email = $1 OR phone = $1) AND id != $2`;
                const loginCheckResult = await this.query(loginCheckQuery, [calculatedLogin, userId]);
                if (loginCheckResult.data.length > 0) {
                    return {
                        success: false,
                        error: 'Login/Email/Phone already exists'
                    };
                }

                patch.login = calculatedLogin;
            }

            const { setSql, params, nextIndex } = buildUpdate(['name', 'email', 'phone', 'profile', 'login'], patch);
            if (!setSql) {
                return {
                    success: false,
                    error: 'No fields to update'
                };
            }

            const updateQuery = `
                UPDATE managerial_auth 
                SET ${setSql}, updated_at = NOW()
                WHERE id = $${nextIndex} AND type = $${nextIndex + 1}
                RETURNING id, name, type, login, email, phone, profile, created_at, updated_at
            `;

            const updateResult = await this.query(updateQuery, [...params, userId, managerialAccountTypes.regular]);

            if (!updateResult.success) {
                return {
                    success: false,
                    error: updateResult.error?.message || updateResult.error || 'Failed to update user (DB Error)'
                };
            }

            if (!updateResult.data || updateResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Failed to update user (No rows updated - ID or Type mismatch)'
                };
            }

            return {
                success: true,
                data: updateResult.data[0],
                message: 'User updated successfully'
            };
        } catch (error) {
            logger.error('Error in updateUser:', error);
            return {
                success: false,
                error: 'An error occurred while updating user'
            };
        }
    }

    /**
     * DELETE - Delete or deactivate user
     * @param {number} userId - User ID
     * @param {number} adminId - ID of admin performing the delete
     * @param {boolean} permanent - If true, hard delete; if false, soft delete
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    deleteUser = async (userId, adminId, permanent = false) => {
        try {
            // Verify user exists and is regular user
            const getUserQuery = `
                SELECT id, name, email 
                FROM managerial_auth 
                WHERE id = $1 AND type = $2
            `;
            const getUserResult = await this.query(getUserQuery, [userId, managerialAccountTypes.regular]);

            if (getUserResult.data.length === 0) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            if (permanent) {
                // Hard delete - permanently remove user
                const deleteQuery = `
                    DELETE FROM managerial_auth 
                    WHERE id = $1 AND type = $2
                    RETURNING id, name, email
                `;
                const deleteResult = await this.query(deleteQuery, [userId, managerialAccountTypes.regular]);

                if (!deleteResult.success || !deleteResult.data || deleteResult.data.length === 0) {
                    return {
                        success: false,
                        error: 'Failed to delete user'
                    };
                }

                return {
                    success: true,
                    message: 'User permanently deleted'
                };
            } else {
                // Soft delete - mark as deleted in profile field (login has NOT NULL constraint)
                // First get current profile
                const currentUser = getUserResult.data.length > 0 ? getUserResult.data[0] : null;
                const currentProfile = currentUser ? (currentUser.profile || {}) : {};

                const deactivateQuery = `
                    UPDATE managerial_auth 
                    SET profile = $1, updated_at = NOW()
                    WHERE id = $2 AND type = $3
                    RETURNING id, name, email
                `;

                const updatedProfile = {
                    ...currentProfile,
                    deleted: true,
                    deleted_at: new Date().toISOString(),
                    deleted_by: adminId
                };

                const deactivateResult = await this.query(deactivateQuery, [
                    updatedProfile,
                    userId,
                    managerialAccountTypes.regular
                ]);

                if (!deactivateResult.success || !deactivateResult.data || deactivateResult.data.length === 0) {
                    return {
                        success: false,
                        error: 'Failed to deactivate user'
                    };
                }

                return {
                    success: true,
                    message: 'User deactivated successfully'
                };
            }
        } catch (error) {
            logger.error('Error in deleteUser:', error);
            return {
                success: false,
                error: 'An error occurred while deleting user'
            };
        }
    }

    /**
     * RESET PASSWORD - Generate and send new password to user
     * @param {number} userId - User ID
     * @param {number} adminId - ID of admin resetting the password
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    resetUserPassword = async (userId, adminId) => {
        try {
            // Get user details
            const getUserResult = await this.getUserDetails(userId);
            if (!getUserResult.success) {
                return getUserResult;
            }

            const user = getUserResult.data;

            // Generate new password
            const plainPassword = this.generatePassword();
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(plainPassword, salt);

            // Update password
            const updateQuery = `
                UPDATE managerial_auth 
                SET password = $1, updated_at = NOW()
                WHERE id = $2 AND type = $3
                RETURNING id, name, email, phone, login
            `;
            const updateResult = await this.query(updateQuery, [
                hashedPassword,
                userId,
                managerialAccountTypes.regular
            ]);

            if (!updateResult.success || !updateResult.data || updateResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Failed to reset password'
                };
            }

            // Send new credentials — prefer phone (SMS) over email
            const contact = user.phone || user.email;
            const contactType = user.phone ? 'phone' : 'email';

            if (contact) {
                const credentialsResult = await this.sendUserCredentials(
                    contact,
                    user.name,
                    user.login,
                    plainPassword,
                    contactType,
                    'reset'
                );

                if (!credentialsResult.success) {
                    logger.error('Failed to send new credentials:', credentialsResult.error);
                    return {
                        success: true,
                        data: updateResult.data[0],
                        password: plainPassword,
                        smsFailed: true,
                        message: 'Password reset but delivery failed. Please share the password manually.'
                    };
                }
            } else {
                return {
                    success: true,
                    data: updateResult.data[0],
                    password: plainPassword,
                    smsFailed: true,
                    message: 'Password reset but user has no phone or email. Please share the password manually.'
                };
            }

            return {
                success: true,
                data: updateResult.data[0],
                message: `Password has been reset and sent via ${contactType === 'phone' ? 'SMS' : 'email'}`
            };
        } catch (error) {
            logger.error('Error in resetUserPassword:', error);
            return {
                success: false,
                error: 'An error occurred while resetting password'
            };
        }
    }

}

module.exports = { UserService };
