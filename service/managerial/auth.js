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

// Max concurrent sessions (devices) for a regular user; oldest is evicted beyond this.
const MAX_REGULAR_SESSIONS = 2;
// OTP brute-force / abuse guards.
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_DAILY_LIMIT = 5;

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

            if (configuredClientId && tokenInfo.aud !== configuredClientId) {
                return {
                    success: false,
                    error: 'Google token audience mismatch'
                };
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

            const contactColumn = 'phone';

            if (purpose === 'registration') {
                const existsResult = await this.query(
                    `SELECT id FROM managerial_auth WHERE login = $1 OR ${contactColumn} = $1`,
                    [value]
                );
                if (existsResult.data.length > 0) {
                    return {
                        success: false,
                        error: `An account already exists with this ${contactType}`
                    };
                }
            }

            if (purpose === 'password_reset') {
                const existsResult = await this.query(
                    `SELECT id FROM managerial_auth WHERE login = $1 OR ${contactColumn} = $1`,
                    [value]
                );
                if (existsResult.data.length === 0) {
                    return {
                        success: false,
                        error: `No account found with this ${contactType}`
                    };
                }
            }

            // Rate limiting: per-contact resend cooldown + daily cap.
            const nowSeconds = Math.floor(Date.now() / 1000);
            const recentResult = await this.query(
                `SELECT timestamp FROM otp
                 WHERE ${contactColumn} = $1 AND purpose = $2
                 ORDER BY timestamp DESC`,
                [value, purpose]
            );
            const recent = recentResult.data || [];
            if (recent.length > 0 && (nowSeconds - recent[0].timestamp) < OTP_RESEND_COOLDOWN_SECONDS) {
                const wait = OTP_RESEND_COOLDOWN_SECONDS - (nowSeconds - recent[0].timestamp);
                return {
                    success: false,
                    error: `Please wait ${wait}s before requesting another code`
                };
            }
            const dayAgo = nowSeconds - 24 * 60 * 60;
            const todayCount = recent.filter(r => r.timestamp >= dayAgo).length;
            if (todayCount >= OTP_DAILY_LIMIT) {
                return {
                    success: false,
                    error: 'Daily OTP limit reached. Please try again later.'
                };
            }

            // Invalidate any prior unused OTPs for this contact+purpose (single active OTP).
            await this.query(
                `UPDATE otp SET is_used = true
                 WHERE ${contactColumn} = $1 AND purpose = $2 AND is_used = false`,
                [value, purpose]
            );

            const otp = generateOTP(6);
            const expiresAt = getOTPExpiration(10); // 10 minutes

            await this.query(
                `INSERT INTO otp (email, phone, contact_type, purpose, otp, timestamp, expires_at, is_used, attempts)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, false, 0)`,
                [
                    contactType === 'email' ? value : null,
                    contactType === 'phone' ? value : null,
                    contactType,
                    purpose,
                    otp,
                    nowSeconds,
                    expiresAt
                ]
            );

            const sendResult = await messagingService.sendOTP(value, contactType, otp, purpose);

            if (!sendResult.success) {
                console.error('Failed to send OTP:', sendResult.error);
                return {
                    success: false,
                    error: 'Failed to send OTP. Please try again.'
                };
            }

            console.log(`OTP sent to ${sanitizeContactForLog(value, contactType)}`);

            const response = {
                success: true,
                message: contactType === 'phone' ? 'OTP sent to your phone' : 'OTP sent to your email'
            };

            if (process.env.NODE_ENV === 'development') {
                response.otp = otp;
            }

            return response;
        } catch (error) {
            console.error('Error in requestOTP:', error);
            return {
                success: false,
                error: 'An error occurred while processing your request'
            };
        }
    }

    /**
     * VERIFY OTP - phone or email, with attempt cap.
     * @param {string} contact - Phone number or email address
     * @param {string} otp - OTP code
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    verifyOTP = async (contact, otp) => {
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

            // Correct code — consume it.
            await this.query(`UPDATE otp SET is_used = true WHERE id = $1`, [otpRecord.id]);

            console.log(`OTP verified for ${sanitizeContactForLog(value, contactType)}`);

            return { success: true, message: 'OTP verified successfully' };
        } catch (error) {
            console.error('Error in verifyOTP:', error);
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
            const { name, login, password, otp } = reqObj;
            const { contactType, value: normalizedLogin } = this.resolveContact(login);

            // Public signup is phone-only (OTP via SMS). Email accounts arrive via Google.
            if (contactType !== 'phone') {
                return {
                    success: false,
                    error: 'Enter a valid phone number'
                };
            }

            if (!password || `${password}`.trim().length < 6) {
                return {
                    success: false,
                    error: 'Password must be at least 6 characters long'
                };
            }

            if (!otp) {
                return {
                    success: false,
                    error: 'OTP is required'
                };
            }

            const contactColumn = contactType === 'phone' ? 'phone' : 'email';
            const existsResult = await this.query(
                `SELECT id FROM managerial_auth WHERE login = $1 OR ${contactColumn} = $1`,
                [normalizedLogin]
            );
            if (existsResult.data.length > 0) {
                return {
                    success: false,
                    error: `An account already exists with this ${contactType}`
                };
            }

            // Enforce OTP verification before creating the account.
            const otpVerification = await this.verifyOTP(normalizedLogin, otp);
            if (!otpVerification.success) {
                return otpVerification;
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPass = await bcrypt.hash(password, salt);
            const finalName = name && `${name}`.trim() ? `${name}`.trim() : 'Student';
            const profile = this.buildProfileWithAuth({}, {
                authProvider: 'password',
                passwordSet: true
            });
            profile.phone_verified = true;
            profile.email_verified = false;

            const phone = normalizedLogin;

            const result = await this.query(
                `INSERT INTO managerial_auth (name, type, login, email, phone, password, profile)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [
                    finalName,
                    managerialAccountTypes.regular,
                    normalizedLogin,
                    null,
                    phone,
                    hashedPass,
                    JSON.stringify(profile)
                ]
            );

            if (result.success) {
                const userId = result.data[0].id;
                const sid = await this.createSession(userId, deviceInfo);
                const tokenObject = this.buildTokenObject(
                    { id: userId, name: finalName, type: managerialAccountTypes.regular, login: normalizedLogin, profile },
                    [], [], sid
                );
                const token = this.signToken(tokenObject, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
                console.log(`New user registered: ${sanitizeContactForLog(normalizedLogin, contactType)}`);

                return {
                    success: true,
                    token,
                    user: {
                        id: userId,
                        name: finalName,
                        type: managerialAccountTypes.regular,
                        email: null,
                        phone
                    }
                };
            }

            return {
                success: false,
                error: 'Registration failed'
            };
        } catch (error) {
            console.error('Error in register:', error);
            return {
                success: false,
                error: 'An error occurred during registration'
            };
        }
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

            // Only regular users get device-limited sessions.
            const sid = user.type === managerialAccountTypes.regular
                ? await this.createSession(user.id, deviceInfo)
                : null;

            const tokenObject = this.buildTokenObject(user, roles, permissions, sid);

            const token = this.signToken(tokenObject, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

            console.log(`User logged in: ${sanitizeContactForLog(user.login, contactType)} with ${roles.length} role(s) and ${permissions.length} permission(s)`);

            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    type: user.type,
                    email: user.email,
                    phone: user.phone,
                    roles: roles,
                    permissions: permissions
                }
            };
        } catch (error) {
            console.error('Error in login:', error);
            return {
                success: false,
                error: 'An error occurred during login'
            };
        }
    }

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

            if (existingResult.data.length > 0) {
                const user = existingResult.data[0];

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
                // Only regular users (type=3) get device-limited sessions; admins/mods
                // keep session-less tokens (consistent with password login).
                const sid = user.type === managerialAccountTypes.regular
                    ? await this.createSession(user.id, deviceInfo)
                    : null;
                const tokenObject = this.buildTokenObject(user, roles, permissions, sid);
                const token = this.signToken(tokenObject, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

                return {
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
                };
            }

            const randomPassword = this.getRandomPin('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 32);
            const salt = await bcrypt.genSalt(10);
            const hashedPass = await bcrypt.hash(randomPassword, salt);
            const profile = this.buildProfileWithAuth({}, {
                authProvider: 'google',
                passwordSet: false
            }, true);
            profile.email_verified = true;
            profile.phone_verified = false;

            const insertResult = await this.query(
                `
                    INSERT INTO managerial_auth (
                        name, type, login, email, phone, password, profile
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id, name, type, login, email, phone, profile
                `,
                [name, managerialAccountTypes.regular, email, email, null, hashedPass, JSON.stringify(profile)]
            );

            if (!insertResult.success || insertResult.data.length === 0) {
                return {
                    success: false,
                    error: insertResult.error || 'Failed to create Google user'
                };
            }

            const user = insertResult.data[0];
            const sid = await this.createSession(user.id, deviceInfo);
            const tokenObject = this.buildTokenObject(user, [], [], sid);
            const token = this.signToken(tokenObject, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    type: user.type,
                    email: user.email,
                    phone: user.phone,
                    roles: [],
                    permissions: []
                }
            };
        } catch (error) {
            console.error('Error in googleLogin:', error);
            return {
                success: false,
                error: 'An error occurred during Google login'
            };
        }
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
            if (!password || `${password}`.trim().length < 6) {
                return { success: false, error: 'Password must be at least 6 characters long' };
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

            const salt = await bcrypt.genSalt(10);
            const hashedPass = await bcrypt.hash(password, salt);
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
            console.error('Error in linkPhone:', error);
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

            const updatedProfile = this.buildProfileWithAuth(user.profile, {
                authProvider: 'google'
            }, Boolean(user.password));
            updatedProfile.email_verified = true;

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
            console.error('Error in connectGoogle:', error);
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

            if (contactType !== 'phone') {
                return {
                    success: false,
                    error: 'Enter a valid phone number'
                };
            }

            if (!newPassword || `${newPassword}`.trim().length < 6) {
                return {
                    success: false,
                    error: 'Password must be at least 6 characters long'
                };
            }

            const otpVerification = await this.verifyOTP(value, otp);
            if (!otpVerification.success) {
                return otpVerification;
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPass = await bcrypt.hash(newPassword, salt);

            const updateResult = await this.query(
                `UPDATE managerial_auth
                 SET password = $1, updated_at = NOW()
                 WHERE login = $2 OR phone = $2
                 RETURNING id`,
                [hashedPass, value]
            );

            if (updateResult.success && updateResult.rowCount > 0) {
                // Log out all devices after a password reset.
                await this.query(
                    `DELETE FROM auth_session WHERE user_id = $1`,
                    [updateResult.data[0].id]
                );
                console.log(`Password reset for ${sanitizeContactForLog(value, contactType)}`);
                return {
                    success: true,
                    message: 'Password updated successfully'
                };
            }

            console.error(`Failed to update password - no rows affected for: ${sanitizeContactForLog(value, contactType)}`);
            return {
                success: false,
                error: 'Failed to update password - user not found'
            };
        } catch (error) {
            console.error('Error in resetPasswordWithOTP:', error);
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
