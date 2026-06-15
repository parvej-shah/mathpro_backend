const Service = require('../base').Service;
const { default: axios } = require('axios');
const bcrypt=require('bcryptjs')
const JWT = require('jsonwebtoken');
const MessagingService=require('../../service/messagingService').MessagingService
const { RoleService } = require('./roleService');
const { managerialAccountTypes } = require('../../util/constants');
const {
    isValidEmail,
    normalizeContact,
    generateOTP,
    getOTPExpiration,
    isOTPExpired,
    sanitizeContactForLog
} = require('../../util/authHelpers');

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

    buildTokenObject = (user, roles = [], permissions = []) => ({
        id: user.id,
        name: user.name,
        type: user.type,
        login: user.login,
        profile: user.profile,
        roles,
        permissions,
        createdAt: Date.now()
    });

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
    // Email-based authentication methods
    // ========================================

    /**
     * REQUEST OTP - Email only
     * @param {string} contact - Email address
     * @param {'registration' | 'password_reset'} purpose - Purpose of OTP
     * @returns {Promise<{success: boolean, message?: string, otp?: string, error?: string}>}
     */
    requestOTP = async (contact, purpose = 'registration') => {
        try {
            const normalizedContact = normalizeContact(contact);

            if (!isValidEmail(normalizedContact)) {
                return {
                    success: false,
                    error: 'Invalid email format'
                };
            }

            if (purpose === 'registration') {
                const existsQuery = `SELECT id FROM managerial_auth WHERE login = $1`;
                const existsResult = await this.query(existsQuery, [normalizedContact]);

                if (existsResult.data.length > 0) {
                    return {
                        success: false,
                        error: 'User already exists with this email'
                    };
                }
            }

            if (purpose === 'password_reset') {
                const existsQuery = `SELECT id FROM managerial_auth WHERE login = $1`;
                const existsResult = await this.query(existsQuery, [normalizedContact]);

                if (existsResult.data.length === 0) {
                    return {
                        success: false,
                        error: 'No account found with this email'
                    };
                }
            }

            const otp = generateOTP(6);
            const expiresAt = getOTPExpiration(10); // 10 minutes
            const timestamp = Math.floor(Date.now() / 1000);

            const saveOTPQuery = `
                INSERT INTO otp (
                    email,
                    otp,
                    timestamp,
                    expires_at,
                    is_used
                ) VALUES ($1, $2, $3, $4, $5)
            `;

            await this.query(saveOTPQuery, [
                normalizedContact,
                otp,
                timestamp,
                expiresAt,
                false
            ]);

            const sendResult = await messagingService.sendOTP(
                normalizedContact,
                'email',
                otp,
                purpose
            );

            if (!sendResult.success) {
                console.error('Failed to send OTP:', sendResult.error);
                return {
                    success: false,
                    error: 'Failed to send OTP. Please try again.'
                };
            }

            console.log(`OTP sent to ${sanitizeContactForLog(normalizedContact, 'email')}`);

            const response = {
                success: true,
                message: 'OTP sent to your email'
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
     * VERIFY OTP
     * @param {string} contact - Email address
     * @param {string} otp - OTP code
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    verifyOTP = async (contact, otp) => {
        try {
            const normalizedContact = normalizeContact(contact);

            if (!isValidEmail(normalizedContact)) {
                return { success: false, error: 'Invalid email format' };
            }

            const verifyQuery = `
                SELECT * FROM otp 
                WHERE email = $1 
                    AND otp = $2 
                    AND is_used = false
                ORDER BY timestamp DESC
                LIMIT 1
            `;
            
            const result = await this.query(verifyQuery, [normalizedContact, otp]);
            
            if (result.data.length === 0) {
                return {
                    success: false,
                    error: 'Invalid or already used OTP'
                };
            }
            
            const otpRecord = result.data[0];
            
            // Check expiration
            if (isOTPExpired(otpRecord.expires_at)) {
                return {
                    success: false,
                    error: 'OTP has expired. Please request a new one.'
                };
            }
            
            // Mark OTP as used
            await this.query(
                `UPDATE otp SET is_used = true WHERE id = $1`,
                [otpRecord.id]
            );

            console.log(`OTP verified for ${sanitizeContactForLog(normalizedContact, 'email')}`);

            return {
                success: true,
                message: 'OTP verified successfully'
            };
        } catch (error) {
            console.error('Error in verifyOTP:', error);
            return {
                success: false,
                error: 'An error occurred while verifying OTP'
            };
        }
    }

    /**
     * REGISTER - Email only public signup for regular users
     * @param {Object} reqObj - {name, login, password, otp}
     * @returns {Promise<{success: boolean, token?: string, user?: Object, error?: string}>}
     */
    register = async (reqObj) => {
        try {
            const { name, login, password } = reqObj;
            const normalizedLogin = normalizeContact(login);

            if (!isValidEmail(normalizedLogin)) {
                return {
                    success: false,
                    error: 'Invalid email format'
                };
            }

            if (!password || `${password}`.trim().length < 6) {
                return {
                    success: false,
                    error: 'Password must be at least 6 characters long'
                };
            }

            const existsQuery = `SELECT id FROM managerial_auth WHERE login = $1 OR email = $1`;
            const existsResult = await this.query(existsQuery, [normalizedLogin]);
            if (existsResult.data.length > 0) {
                return {
                    success: false,
                    error: 'User already exists with this email'
                };
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPass = await bcrypt.hash(password, salt);
            const finalName = name && `${name}`.trim() ? `${name}`.trim() : this.deriveNameFromEmail(normalizedLogin);
            const profile = this.buildProfileWithAuth({}, {
                authProvider: 'password',
                passwordSet: true
            });

            const insertQuery = `
                INSERT INTO managerial_auth (
                    name, type, login, email, phone, password, profile
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
                RETURNING id
            `;
            
            const insertParams = [
                finalName,
                managerialAccountTypes.regular,
                normalizedLogin,
                normalizedLogin,
                null,
                hashedPass,
                JSON.stringify(profile)
            ];

            const result = await this.query(insertQuery, insertParams);

            if (result.success) {
                const tokenObject = {
                    id: result.data[0].id,
                    name: finalName,
                    type: managerialAccountTypes.regular,
                    login: normalizedLogin,
                    roles: [],
                    permissions: [],
                    createdAt: Date.now()
                };
                const token = this.signToken(tokenObject, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
                console.log(`New user registered: ${sanitizeContactForLog(normalizedLogin, 'email')}`);

                return {
                    success: true,
                    token,
                    user: {
                        id: result.data[0].id,
                        name: finalName,
                        type: managerialAccountTypes.regular
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
     * LOGIN - Email only
     * @param {Object} credentials - {login, password}
     * @returns {Promise<{success: boolean, token?: string, user?: Object, error?: string}>}
     */
    login = async ({ login, password }) => {
        try {
            const normalizedLogin = normalizeContact(login);

            if (!isValidEmail(normalizedLogin)) {
                return {
                    success: false,
                    error: 'Invalid email format'
                };
            }

            const loginFindQuery = `SELECT * FROM managerial_auth WHERE login = $1`;
            const loginFindResult = await this.query(loginFindQuery, [normalizedLogin]);

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

            const tokenObject = this.buildTokenObject(user, roles, permissions);

            const token = this.signToken(tokenObject, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

            console.log(`User logged in: ${sanitizeContactForLog(user.login, 'email')} with ${roles.length} role(s) and ${permissions.length} permission(s)`);

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

    googleLogin = async ({ id_token }) => {
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

                if (user.type !== managerialAccountTypes.regular) {
                    return {
                        success: false,
                        error: 'This Google account is not allowed for student login'
                    };
                }

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
                const tokenObject = this.buildTokenObject(user, roles, permissions);
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
            const tokenObject = this.buildTokenObject(user, [], []);
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
     * RESET PASSWORD with OTP
     * @param {string} contact - Email address
     * @param {string} otp - OTP code
     * @param {string} newPassword - New password
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    resetPasswordWithOTP = async (contact, otp, newPassword) => {
        try {
            const normalizedContact = normalizeContact(contact);

            if (!isValidEmail(normalizedContact)) {
                return {
                    success: false,
                    error: 'Invalid email format'
                };
            }

            const otpVerification = await this.verifyOTP(normalizedContact, otp);
            if (!otpVerification.success) {
                return otpVerification;
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPass = await bcrypt.hash(newPassword, salt);

            const updateQuery = `
                UPDATE managerial_auth 
                SET password = $1 
                WHERE login = $2
            `;

            const updateResult = await this.query(updateQuery, [hashedPass, normalizedContact]);

            if (updateResult.success && updateResult.rowCount > 0) {
                console.log(`Password reset for ${sanitizeContactForLog(normalizedContact, 'email')}`);
                return {
                    success: true,
                    message: 'Password updated successfully'
                };
            }

            console.error(`Failed to update password - no rows affected for: ${sanitizeContactForLog(normalizedContact, 'email')}`);
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
