const Service = require('../base').Service;
const { default: axios } = require('axios');
const bcrypt=require('bcryptjs')
const JWT = require('jsonwebtoken');
const crypto = require('crypto');
const MessagingService=require('../../service/messagingService').MessagingService
const { RoleService } = require('./roleService');
const { managerialAccountTypes } = require('../../util/constants');
const {
    isValidEmail,
    isValidPhone,
    detectContactType,
    normalizeContact,
    normalizePhone,
    normalizeIdentifier,
    generateOTP,
    getOTPExpiration,
    isOTPExpired,
    sanitizeContactForLog
} = require('../../util/authHelpers');
const logger = require('../../util/logger');

// Max concurrent sessions (devices) for a regular user; oldest is evicted beyond this.
const MAX_REGULAR_SESSIONS = 2;
// OTP brute-force / abuse guards.
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_DAILY_LIMIT = 5;

// Who may request a code for each purpose: the account lookup, whether a match must exist,
// and the reply when the rule isn't met.
const OTP_ACCOUNT_RULES = {
    registration: {
        sql: `SELECT id FROM managerial_auth WHERE login = $1 OR phone = $1`,
        mustExist: false,
        refusal: 'An account already exists with this phone'
    },
    password_reset: {
        sql: `SELECT id FROM managerial_auth WHERE login = $1 OR phone = $1`,
        mustExist: true,
        refusal: 'No account found with this phone'
    },
    phone_change: {
        sql: `SELECT id FROM managerial_auth WHERE phone = $1`,
        mustExist: false,
        refusal: 'An account already exists with this phone'
    }
};

const PASSWORD_TOO_SHORT = 'Password must be at least 6 characters long';
const isPasswordTooShort = (password) => !password || `${password}`.trim().length < 6;

// Sign-up and password reset take a phone number and a new password; returns the refusal or null.
const phoneAndPasswordRefusal = (contactType, password) => {
    if (contactType !== 'phone') return 'Enter a valid phone number';
    if (isPasswordTooShort(password)) return PASSWORD_TOO_SHORT;
    return null;
};

const messagingService=new MessagingService()
const roleService = new RoleService()

class AuthService extends Service {
    constructor() {
        super();
    }

    signToken = (user, options = {}) => {
        return JWT.sign(user, process.env.JWT_SECRET, options);
    };

    getSafeProfile = (profile) => (
        profile && typeof profile === 'object' && !Array.isArray(profile) ? { ...profile } : {}
    );

    getAuthMetadata = (profile, hasStoredPassword = true) => {
        const safeProfile = this.getSafeProfile(profile);
        const authProviders = Array.isArray(safeProfile.auth_providers)
            ? [...new Set(safeProfile.auth_providers.filter(Boolean))]
            : [];

        const passwordSet = typeof safeProfile.password_set === 'boolean'
            ? safeProfile.password_set
            : Boolean(hasStoredPassword);

        return {
            safeProfile,
            authProviders,
            passwordSet
        };
    };

    buildProfileWithAuth = (profile, updates = {}, hasStoredPassword = true) => {
        const { safeProfile, authProviders, passwordSet } = this.getAuthMetadata(profile, hasStoredPassword);

        const nextProviders = updates.authProvider
            ? [...new Set([...authProviders, updates.authProvider])]
            : authProviders;

        return {
            ...safeProfile,
            ...(updates.passwordSet !== undefined ? { password_set: updates.passwordSet } : { password_set: passwordSet }),
            auth_providers: nextProviders
        };
    };

    deriveNameFromEmail = (email) => {
        const localPart = `${email || ''}`.split('@')[0] || 'Student';
        const normalized = localPart.replace(/[._-]+/g, ' ').trim();
        return normalized
            ? normalized.replace(/\b\w/g, (char) => char.toUpperCase())
            : 'Student';
    };

    buildTokenObject = (user, roles = [], permissions = [], sid = null) => ({
        id: user.id,
        name: user.name,
        type: user.type,
        login: user.login,
        profile: user.profile,
        roles,
        permissions,
        ...(sid ? { sid } : {}),
        createdAt: Date.now()
    });

    hashPassword = async (password) => bcrypt.hash(password, await bcrypt.genSalt(10));

    // The sign-in token: regular users get a device-limited session (sid); admins and
    // moderators keep session-less tokens.
    issueToken = async (user, roles, permissions, deviceInfo) => {
        const sid = user.type === managerialAccountTypes.regular
            ? await this.createSession(user.id, deviceInfo)
            : null;
        const tokenObject = this.buildTokenObject(user, roles, permissions, sid);
        return this.signToken(tokenObject, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    };

    // The login / Google login reply.
    signedInReply = (user, token, roles, permissions) => ({
        success: true,
        token,
        user: {
            id: user.id,
            name: user.name,
            type: user.type,
            email: user.email,
            phone: user.phone,
            roles,
            permissions
        }
    });

    // ========================================
    // Session management (regular-user device limit)
    // ========================================

    /**
     * Create a session row for a user and enforce the max-device cap by evicting
     * the oldest sessions beyond the limit. Returns the new session_id (sid).
     * @param {number} userId
     * @param {{userAgent?: string, ip?: string}} deviceInfo
     * @returns {Promise<string>} session_id
     */
    createSession = async (userId, deviceInfo = {}) => {
        const sessionId = crypto.randomUUID();
        const userAgent = (deviceInfo.userAgent || '').slice(0, 255) || null;
        const ip = (deviceInfo.ip || '').slice(0, 64) || null;

        await this.query(
            `INSERT INTO auth_session (user_id, session_id, user_agent, ip)
             VALUES ($1, $2, $3, $4)`,
            [userId, sessionId, userAgent, ip]
        );

        // Keep only the newest MAX_REGULAR_SESSIONS sessions; evict the rest.
        await this.query(
            `DELETE FROM auth_session
             WHERE user_id = $1
               AND session_id NOT IN (
                   SELECT session_id FROM auth_session
                   WHERE user_id = $1
                   ORDER BY created_at DESC, id DESC
                   LIMIT $2
               )`,
            [userId, MAX_REGULAR_SESSIONS]
        );

        return sessionId;
    };

    /**
     * Delete a single session (logout this device).
     * @param {number} userId
     * @param {string} sessionId
     */
    revokeSession = async (userId, sessionId) => {
        if (!sessionId) return { success: false, error: 'No session' };
        const result = await this.query(
            `DELETE FROM auth_session WHERE user_id = $1 AND session_id = $2`,
            [userId, sessionId]
        );
        return { success: result.success, message: 'Logged out' };
    };

    /**
     * List active sessions (devices) for a user.
     * @param {number} userId
     */
    listSessions = async (userId) => {
        const result = await this.query(
            `SELECT session_id, user_agent, ip, created_at, last_seen_at
             FROM auth_session WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return { success: result.success, data: result.data || [] };
    };

    getUserRolesAndPermissions = async (userId) => {
        const rolesResult = await roleService.getUserRoles(userId);
        const permissionsResult = await roleService.getUserPermissions(userId);

        return {
            roles: rolesResult.success ? rolesResult.data.map(r => ({
                id: r.id,
                name: r.name,
                display_name: r.display_name
            })) : [],
            permissions: permissionsResult.success ? permissionsResult.data : []
        };
    };

    verifyGoogleToken = async (idToken) => {
        if (!idToken || typeof idToken !== 'string') {
            return {
                success: false,
                error: 'Google id_token is required'
            };
        }

        try {
            const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
                params: { id_token: idToken },
                timeout: 10000
            });

            const tokenInfo = response.data || {};
            const email = normalizeContact(tokenInfo.email);
            const emailVerified = `${tokenInfo.email_verified}` === 'true';
            const configuredClientId = process.env.GOOGLE_CLIENT_ID?.trim();

            if (!isValidEmail(email)) {
                return {
                    success: false,
                    error: 'Google account email is missing or invalid'
                };
            }

            if (!emailVerified) {
                return {
                    success: false,
                    error: 'Google account email is not verified'
                };
            }

            if (configuredClientId) {
                const allowedAudiences = configuredClientId.split(',').map((s) => s.trim()).filter(Boolean);
                if (allowedAudiences.length > 0 && !allowedAudiences.includes(tokenInfo.aud)) {
                    return {
                        success: false,
                        error: 'Google token audience mismatch'
                    };
                }
            }

            return {
                success: true,
                data: {
                    email,
                    name: tokenInfo.name || email.split('@')[0]
                }
            };
        } catch (error) {
            const googleError = error?.response?.data?.error_description || error?.response?.data?.error;
            return {
                success: false,
                error: googleError || 'Failed to verify Google token'
            };
        }
    };

    getRandomPin = (chars, len)=>[...Array(len)].map(
        (i)=>chars[Math.floor(Math.random()*chars.length)]
    ).join('');

    // ========================================
    // OTP methods (phone or email)
    // ========================================

    /**
     * Resolve a login identifier into its normalized form + contact type.
     * @param {string} contact
     * @returns {{ contactType: 'email'|'phone'|null, value: string }}
     */
    resolveContact = (contact) => {
        const value = normalizeIdentifier(contact);
        const contactType = detectContactType(value);
        return { contactType, value: contactType ? value : '' };
    };

    /**
     * REQUEST OTP - phone or email
     * @param {string} contact - Phone number or email address
     * @param {'registration' | 'password_reset'} purpose - Purpose of OTP
     * @returns {Promise<{success: boolean, message?: string, otp?: string, error?: string}>}
     */
    requestOTP = async (contact, purpose = 'registration') => {
        try {
            const { contactType, value } = this.resolveContact(contact);

            // OTP is delivered by SMS only; email OTP is not supported (cost control).
            if (contactType !== 'phone') {
                return {
                    success: false,
                    error: 'Enter a valid phone number'
                };
            }

            const nowSeconds = Math.floor(Date.now() / 1000);
            const refusal = await this.otpAccountRefusal(value, purpose)
                || await this.otpRateLimitRefusal(value, purpose, nowSeconds);
            if (refusal) return { success: false, error: refusal };

            // Invalidate any prior unused OTPs for this phone+purpose (single active OTP).
            await this.query(
                `UPDATE otp SET is_used = true
                 WHERE phone = $1 AND purpose = $2 AND is_used = false`,
                [value, purpose]
            );

            const otp = generateOTP(6);
            const expiresAt = getOTPExpiration(10); // 10 minutes

            const insertResult = await this.query(
                `INSERT INTO otp (email, phone, purpose, otp, timestamp, expires_at, is_used, attempts)
                 VALUES (NULL, $1, $2, $3, $4, $5, false, 0)`,
                [value, purpose, otp, nowSeconds, expiresAt]
            );

            if (!insertResult.success) {
                logger.error('Failed to store OTP');
                return {
                    success: false,
                    error: 'Failed to process OTP. Please try again.'
                };
            }

            const sendResult = await messagingService.sendOTP(value, contactType, otp, purpose);

            if (!sendResult.success) {
                logger.error('Failed to send OTP:', sendResult.error);
                return {
                    success: false,
                    error: 'Failed to send OTP. Please try again.'
                };
            }

            console.log(`OTP sent to ${sanitizeContactForLog(value, contactType)}`);

            const response = {
                success: true,
                message: 'OTP sent to your phone'
            };

            if (process.env.NODE_ENV === 'development') {
                response.otp = otp;
            }

            return response;
        } catch (error) {
            logger.error('Error in requestOTP:', error);
            return {
                success: false,
                error: 'An error occurred while processing your request'
            };
        }
    }

    // Whether this phone may get a code for `purpose` (see OTP_ACCOUNT_RULES); returns the
    // refusal message or null. Purposes without a rule are not checked.
    otpAccountRefusal = async (phone, purpose) => {
        const rule = OTP_ACCOUNT_RULES[purpose];
        if (!rule) return null;
        const existsResult = await this.query(rule.sql, [phone]);
        const exists = existsResult.data.length > 0;
        return exists === rule.mustExist ? null : rule.refusal;
    }

    // Per phone+purpose resend cooldown and daily cap; returns the refusal message or null.
    otpRateLimitRefusal = async (phone, purpose, nowSeconds) => {
        const recentResult = await this.query(
            `SELECT timestamp FROM otp
             WHERE phone = $1 AND purpose = $2
             ORDER BY timestamp DESC`,
            [phone, purpose]
        );
        const recent = recentResult.data || [];
        if (recent.length > 0 && (nowSeconds - recent[0].timestamp) < OTP_RESEND_COOLDOWN_SECONDS) {
            const wait = OTP_RESEND_COOLDOWN_SECONDS - (nowSeconds - recent[0].timestamp);
            return `Please wait ${wait}s before requesting another code`;
        }
        const dayAgo = nowSeconds - 24 * 60 * 60;
        const todayCount = recent.filter(r => r.timestamp >= dayAgo).length;
        if (todayCount >= OTP_DAILY_LIMIT) {
            return 'Daily OTP limit reached. Please try again later.';
        }
        return null;
    }

    /**
     * VERIFY OTP - phone or email, with attempt cap.
     * @param {string} contact - Phone number or email address
     * @param {string} otp - OTP code
     * @param {boolean} consume - Whether to mark the OTP as used (default true)
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    verifyOTP = async (contact, otp, consume = true) => {
        try {
            const { contactType, value } = this.resolveContact(contact);

            if (!contactType) {
                return { success: false, error: 'Enter a valid phone number or email' };
            }

            const contactColumn = contactType === 'phone' ? 'phone' : 'email';

            // Latest unused OTP for this contact.
            const result = await this.query(
                `SELECT * FROM otp
                 WHERE ${contactColumn} = $1 AND is_used = false
                 ORDER BY timestamp DESC
                 LIMIT 1`,
                [value]
            );

            if (result.data.length === 0) {
                return { success: false, error: 'No active code. Please request a new one.' };
            }

            const otpRecord = result.data[0];

            if (isOTPExpired(otpRecord.expires_at)) {
                await this.query(`UPDATE otp SET is_used = true WHERE id = $1`, [otpRecord.id]);
                return { success: false, error: 'OTP has expired. Please request a new one.' };
            }

            if ((otpRecord.attempts || 0) >= OTP_MAX_ATTEMPTS) {
                await this.query(`UPDATE otp SET is_used = true WHERE id = $1`, [otpRecord.id]);
                return { success: false, error: 'Too many attempts. Please request a new code.' };
            }

            if (`${otpRecord.otp}` !== `${otp}`.trim()) {
                await this.query(`UPDATE otp SET attempts = attempts + 1 WHERE id = $1`, [otpRecord.id]);
                return { success: false, error: 'Invalid OTP' };
            }

            if (consume) {
                await this.query(`UPDATE otp SET is_used = true WHERE id = $1`, [otpRecord.id]);
            }

            console.log(`OTP verified for ${sanitizeContactForLog(value, contactType)}`);

            return { success: true, message: 'OTP verified successfully' };
        } catch (error) {
            logger.error('Error in verifyOTP:', error);
            return {
                success: false,
                error: 'An error occurred while verifying OTP'
            };
        }
    }

    /**
     * REGISTER - phone-primary public signup for regular users (email also accepted).
     * OTP is required and verified before the account is created.
     * @param {Object} reqObj - {name, login, password, otp}
     * @param {{userAgent?: string, ip?: string}} deviceInfo
     * @returns {Promise<{success: boolean, token?: string, user?: Object, error?: string}>}
     */
    register = async (reqObj, deviceInfo = {}) => {
        try {
            const { name, login, password, otp, email: rawEmail } = reqObj;
            // Public signup is phone-only (OTP via SMS). Email accounts arrive via Google.
            const { contactType, value: phone } = this.resolveContact(login);
            const email = rawEmail && `${rawEmail}`.trim() ? `${rawEmail}`.trim().toLowerCase() : null;

            const refusal = phoneAndPasswordRefusal(contactType, password)
                || (otp ? null : 'OTP is required')
                || await this.registrationTakenRefusal(phone, email);
            if (refusal) return { success: false, error: refusal };

            // Enforce OTP verification before creating the account.
            const otpVerification = await this.verifyOTP(phone, otp);
            if (!otpVerification.success) {
                return otpVerification;
            }

            const user = {
                name: name && `${name}`.trim() ? `${name}`.trim() : 'Student',
                type: managerialAccountTypes.regular,
                login: phone,
                email,
                phone,
                profile: {
                    ...this.buildProfileWithAuth({}, { authProvider: 'password', passwordSet: true }),
                    phone_verified: true,
                    email_verified: false
                }
            };

            const result = await this.query(
                `INSERT INTO managerial_auth (name, type, login, email, phone, password, profile)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [user.name, user.type, user.login, email, phone, await this.hashPassword(password), JSON.stringify(user.profile)]
            );
            if (!result.success) {
                return { success: false, error: 'Registration failed' };
            }

            user.id = result.data[0].id;
            const token = await this.issueToken(user, [], [], deviceInfo);
            console.log(`New user registered: ${sanitizeContactForLog(phone, contactType)}`);

            return {
                success: true,
                token,
                user: { id: user.id, name: user.name, type: user.type, email, phone }
            };
        } catch (error) {
            logger.error('Error in register:', error);
            return {
                success: false,
                error: 'An error occurred during registration'
            };
        }
    }

    // A sign-up phone (as login or phone) or email that already has an account; returns the
    // refusal or null.
    registrationTakenRefusal = async (phone, email) => {
        const phoneTaken = await this.query(`SELECT id FROM managerial_auth WHERE login = $1 OR phone = $1`, [phone]);
        if (phoneTaken.data.length > 0) return 'An account already exists with this phone';
        if (!email) return null;
        const emailTaken = await this.query(`SELECT id FROM managerial_auth WHERE email = $1`, [email]);
        return emailTaken.data.length > 0 ? 'An account already exists with this email' : null;
    }

    /**
     * LOGIN - by phone or email. Regular users (type=3) get a tracked session
     * (device limit enforced); admins/moderators keep their session-less token.
     * @param {Object} credentials - {login, password}
     * @param {{userAgent?: string, ip?: string}} deviceInfo
     * @returns {Promise<{success: boolean, token?: string, user?: Object, error?: string}>}
     */
    login = async ({ login, password }, deviceInfo = {}) => {
        try {
            const { contactType, value: normalizedLogin } = this.resolveContact(login);

            if (!contactType) {
                return {
                    success: false,
                    error: 'Enter a valid phone number or email'
                };
            }

            // Match on the canonical column: email identifiers via the email column,
            // phone identifiers via the phone column. login is no longer a lookup key.
            const contactColumn = contactType === 'phone' ? 'phone' : 'email';
            const loginFindResult = await this.query(
                `SELECT * FROM managerial_auth WHERE ${contactColumn} = $1 LIMIT 1`,
                [normalizedLogin]
            );

            if (loginFindResult.data.length === 0) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            const user = loginFindResult.data[0];
            const isPassValid = await bcrypt.compare(password, user.password);

            if (!isPassValid) {
                return {
                    success: false,
                    error: 'Invalid password'
                };
            }

            const { roles, permissions } = await this.getUserRolesAndPermissions(user.id);
            const token = await this.issueToken(user, roles, permissions, deviceInfo);

            console.log(`User logged in: ${sanitizeContactForLog(user.login, contactType)} with ${roles.length} role(s) and ${permissions.length} permission(s)`);

            return this.signedInReply(user, token, roles, permissions);
        } catch (error) {
            logger.error('Error in login:', error);
            return {
                success: false,
                error: 'An error occurred during login'
            };
        }
    }

    // Google sign-in: signs in the account with this Google email (as email or login), or
    // creates a regular account for it.
    googleLogin = async ({ id_token }, deviceInfo = {}) => {
        try {
            const googleVerification = await this.verifyGoogleToken(id_token);
            if (!googleVerification.success) {
                return googleVerification;
            }

            const { email, name } = googleVerification.data;
            const existingResult = await this.query(
                `SELECT * FROM managerial_auth WHERE login = $1 OR email = $1 LIMIT 1`,
                [email]
            );

            return existingResult.data.length > 0
                ? await this.googleSignIn(existingResult.data[0], deviceInfo)
                : await this.googleSignUp(email, name, deviceInfo);
        } catch (error) {
            logger.error('Error in googleLogin:', error);
            return {
                success: false,
                error: 'An error occurred during Google login'
            };
        }
    }

    // Existing account: records google as an auth provider (only if that changes the
    // profile), then signs in like a password login.
    googleSignIn = async (user, deviceInfo) => {
        const updatedProfile = this.buildProfileWithAuth(user.profile, {
            authProvider: 'google'
        }, Boolean(user.password));

        if (JSON.stringify(updatedProfile) !== JSON.stringify(this.getSafeProfile(user.profile))) {
            const updateProfileResult = await this.query(
                `UPDATE managerial_auth SET profile = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
                [JSON.stringify(updatedProfile), user.id]
            );
            if (updateProfileResult.success && updateProfileResult.data.length > 0) {
                Object.assign(user, updateProfileResult.data[0]);
            }
        }

        const { roles, permissions } = await this.getUserRolesAndPermissions(user.id);
        const token = await this.issueToken(user, roles, permissions, deviceInfo);
        return this.signedInReply(user, token, roles, permissions);
    }

    // New Google account: a regular user with an unusable random password (password_set false).
    googleSignUp = async (email, name, deviceInfo) => {
        const randomPassword = this.getRandomPin('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 32);
        const profile = {
            ...this.buildProfileWithAuth({}, { authProvider: 'google', passwordSet: false }, true),
            email_verified: true,
            phone_verified: false
        };

        const insertResult = await this.query(
            `
                INSERT INTO managerial_auth (
                    name, type, login, email, phone, password, profile
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, name, type, login, email, phone, profile
            `,
            [name, managerialAccountTypes.regular, email, email, null, await this.hashPassword(randomPassword), JSON.stringify(profile)]
        );

        if (!insertResult.success || insertResult.data.length === 0) {
            return {
                success: false,
                error: insertResult.error || 'Failed to create Google user'
            };
        }

        const user = insertResult.data[0];
        const token = await this.issueToken(user, [], [], deviceInfo);
        return this.signedInReply(user, token, [], []);
    }

    /**
     * LINK PHONE - for a logged-in user (typically Google-first) to add a verified
     * phone number and set/confirm a password. Requires a verified OTP for the phone.
     * @param {number} userId
     * @param {{phone: string, password: string, otp: string}} reqObj
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    linkPhone = async (userId, { phone, password, otp }) => {
        try {
            const normalizedPhone = normalizePhone(phone);

            if (!isValidPhone(normalizedPhone)) {
                return { success: false, error: 'Enter a valid phone number' };
            }
            if (isPasswordTooShort(password)) {
                return { success: false, error: PASSWORD_TOO_SHORT };
            }
            if (!otp) {
                return { success: false, error: 'OTP is required' };
            }

            // Phone must not already belong to another account.
            const existsResult = await this.query(
                `SELECT id FROM managerial_auth WHERE (phone = $1 OR login = $1) AND id <> $2 LIMIT 1`,
                [normalizedPhone, userId]
            );
            if (existsResult.data.length > 0) {
                return { success: false, error: 'This phone number is already in use' };
            }

            const otpVerification = await this.verifyOTP(normalizedPhone, otp);
            if (!otpVerification.success) {
                return otpVerification;
            }

            const userResult = await this.query(`SELECT * FROM managerial_auth WHERE id = $1`, [userId]);
            if (userResult.data.length === 0) {
                return { success: false, error: 'User not found' };
            }
            const user = userResult.data[0];

            const hashedPass = await this.hashPassword(password);
            const updatedProfile = this.buildProfileWithAuth(user.profile, {
                authProvider: 'password',
                passwordSet: true
            }, true);
            updatedProfile.phone_verified = true;

            const updateResult = await this.query(
                `UPDATE managerial_auth
                 SET phone = $1, password = $2, profile = $3, updated_at = NOW()
                 WHERE id = $4`,
                [normalizedPhone, hashedPass, JSON.stringify(updatedProfile), userId]
            );

            if (!updateResult.success) {
                return { success: false, error: 'Failed to link phone number' };
            }

            console.log(`Phone linked for user ${userId}: ${sanitizeContactForLog(normalizedPhone, 'phone')}`);
            return { success: true, message: 'Phone number linked successfully' };
        } catch (error) {
            logger.error('Error in linkPhone:', error);
            return { success: false, error: 'An error occurred while linking phone' };
        }
    }

    /**
     * CONNECT GOOGLE - for a logged-in user (typically phone-registered) to attach
     * or change the Google-verified email on their account. Google is the email
     * verification mechanism (no email OTP). Re-running with a different Google
     * account replaces the stored email. The email must not belong to another user.
     * @param {number} userId
     * @param {{id_token: string}} reqObj
     * @returns {Promise<{success: boolean, message?: string, email?: string, error?: string}>}
     */
    connectGoogle = async (userId, { id_token }) => {
        try {
            const googleVerification = await this.verifyGoogleToken(id_token);
            if (!googleVerification.success) {
                return googleVerification;
            }

            const { email } = googleVerification.data;

            // The Google email must not already belong to a different account.
            const existsResult = await this.query(
                `SELECT id FROM managerial_auth WHERE (email = $1 OR login = $1) AND id <> $2 LIMIT 1`,
                [email, userId]
            );
            if (existsResult.data.length > 0) {
                return { success: false, error: 'This Google account is already linked to another user' };
            }

            const userResult = await this.query(`SELECT * FROM managerial_auth WHERE id = $1`, [userId]);
            if (userResult.data.length === 0) {
                return { success: false, error: 'User not found' };
            }
            const user = userResult.data[0];

            // 7-day cooldown on email changes (only applies when changing, not first connect)
            if (user.email) {
                const existingProfile = user.profile && typeof user.profile === 'object' ? user.profile : {};
                if (existingProfile.email_changed_at) {
                    const lastChanged = new Date(existingProfile.email_changed_at);
                    const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSince < 7) {
                        const remaining = Math.ceil(7 - daysSince);
                        return { success: false, error: `Email can only be changed once every 7 days. Try again in ${remaining} day(s).` };
                    }
                }
            }

            const updatedProfile = this.buildProfileWithAuth(user.profile, {
                authProvider: 'google'
            }, Boolean(user.password));
            updatedProfile.email_verified = true;
            updatedProfile.email_changed_at = new Date().toISOString();

            const updateResult = await this.query(
                `UPDATE managerial_auth
                 SET email = $1, profile = $2, updated_at = NOW()
                 WHERE id = $3`,
                [email, JSON.stringify(updatedProfile), userId]
            );

            if (!updateResult.success) {
                return { success: false, error: 'Failed to connect Google account' };
            }

            console.log(`Google connected for user ${userId}: ${sanitizeContactForLog(email, 'email')}`);
            return { success: true, message: 'Google account connected', email };
        } catch (error) {
            logger.error('Error in connectGoogle:', error);
            return { success: false, error: 'An error occurred while connecting Google' };
        }
    }

    /**
     * RESET PASSWORD with OTP - phone only (OTP via SMS). Revokes all existing
     * sessions so other devices are logged out after a reset. Legacy email-only
     * accounts without a phone recover via Google login instead.
     * @param {string} contact - Phone number
     * @param {string} otp - OTP code
     * @param {string} newPassword - New password
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    resetPasswordWithOTP = async (contact, otp, newPassword) => {
        try {
            const { contactType, value } = this.resolveContact(contact);

            const refusal = phoneAndPasswordRefusal(contactType, newPassword);
            if (refusal) return { success: false, error: refusal };

            const otpVerification = await this.verifyOTP(value, otp);
            if (!otpVerification.success) {
                return otpVerification;
            }

            const updateResult = await this.query(
                `UPDATE managerial_auth
                 SET password = $1, updated_at = NOW()
                 WHERE login = $2 OR phone = $2
                 RETURNING id`,
                [await this.hashPassword(newPassword), value]
            );

            if (!updateResult.success || updateResult.rowCount === 0) {
                logger.error(`Failed to update password - no rows affected for: ${sanitizeContactForLog(value, contactType)}`);
                return {
                    success: false,
                    error: 'Failed to update password - user not found'
                };
            }

            // Log out all devices after a password reset.
            await this.query(`DELETE FROM auth_session WHERE user_id = $1`, [updateResult.data[0].id]);
            console.log(`Password reset for ${sanitizeContactForLog(value, contactType)}`);
            return {
                success: true,
                message: 'Password updated successfully'
            };
        } catch (error) {
            logger.error('Error in resetPasswordWithOTP:', error);
            return {
                success: false,
                error: 'An error occurred while resetting password'
            };
        }
    }

    getUserProfile= async (userId)=>{
      // Fixed: Use phone and email columns instead of login
      const basicInfoQuery=`
        select name, phone, email, profile from managerial_auth where id=$1
      `
      const basicInfoParams=[userId]
      var result=await this.query(basicInfoQuery,basicInfoParams)
      var profile={
        basicInfo:{
          ...result.data[0],
          ...result.data[0].profile
        }
      }
      delete profile.basicInfo.profile

      const enrolledCoursesQuery=`
        select 
          c.title,
          c.id as course_id,
          t.timestamp as enrolled, 
          (
            select 
              max(m.serial) 
            from 
              module m, 
              chapter ch
            where
              m.chapter_id=ch.id
              and ch.course_id=c.id 
          ) as max_serial,
          (
            select
              max(m.serial)
            from
              module m,
              chapter ch,
              progress p
            where
              p.module_id=m.id
              and m.chapter_id=ch.id
              and ch.course_id=c.id 
              and p.user_id=$1
          ) as current_serial,
          (
          select
            max(p.timestamp)
          from
            module m,
            chapter ch,
            progress p
          where
            p.module_id=m.id
            and m.chapter_id=ch.id
            and ch.course_id=c.id 
            and p.user_id=$1
          ) as last_accessed
        from
          course c,
          takes t
        where
          t.course_id=c.id
          and t.user_id=$2
      `
      const enrolledCoursesParams=[userId,userId]
      var enrolledCoursesResult=await this.query(enrolledCoursesQuery,enrolledCoursesParams)

      profile['enrolledCourses']=enrolledCoursesResult.data

      return {
        success:true,
        data:profile
      }
    }
     
    getProfile=async (id)=>{
      var query=`select * from managerial_auth where id=$1 `
      var params=[id]
      var result=await this.query(query,params)
      return result
    }

    setProfile=async (id,name,profile)=>{
      var query=`update managerial_auth set name=$1 , profile=$2 where id=$3`
      var params=[name,profile,id]
      var result=await this.query(query,params)
      return result
    }

    
}

module.exports = {AuthService}
