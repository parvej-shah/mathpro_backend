const Service = require('../base').Service;
const bcrypt=require('bcryptjs');
const { normalizeContact, isValidEmail, isValidPhone } = require('../../util/authHelpers');
const AuthService = require('../managerial/auth').AuthService;

const authService = new AuthService();

const CHANGE_COOLDOWN_DAYS = 7;

class ProfileService extends Service {
    constructor() {
        super();
    }

    trimToNull = (value) => {
        if (value === undefined || value === null) {
            return null;
        }

        const text = `${value}`.trim();
        return text || null;
    };

    pickFirstProfileValue = (...values) => {
        for (const value of values) {
            const normalized = this.trimToNull(value);
            if (normalized) {
                return normalized;
            }
        }

        return null;
    };

    pickEnumProfileValue = (allowedValues, ...values) => {
        const candidate = this.pickFirstProfileValue(...values);
        if (!candidate) {
            return null;
        }

        const matchedValue = allowedValues.find((allowed) => allowed.toLowerCase() === candidate.toLowerCase());
        return matchedValue || candidate;
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

    /**
     * Get user profile for checkout modal
     */
    getUserProfileForCheckout = async (userId) => {
        try {
            const query = `
                SELECT 
                    id,
                    name,
                    email,
                    phone,
                    login,
                    password,
                    profile
                FROM managerial_auth
                WHERE id = $1
            `;
            
            const result = await this.query(query, [userId]);
            
            if (!result.success || result.data.length === 0) {
                return { 
                    success: false, 
                    error: 'User not found' 
                };
            }
            
            const user = result.data[0];
            const { safeProfile: profileData, authProviders, passwordSet } = this.getAuthMetadata(
                user.profile,
                Boolean(user.password)
            );
            const schoolCollege = this.pickFirstProfileValue(profileData.schoolCollege);
            const classLevel = this.pickEnumProfileValue(['JSC', 'SSC', 'HSC'], profileData.classLevel);

            // Format response to match requirements
            return {
                success: true,
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    login: user.login,
                    auth_providers: authProviders,
                    has_password: passwordSet,
                    profile: {
                        email: user.email || null,
                        phone: user.phone || null,
                        facebookId: this.pickFirstProfileValue(profileData.facebookId, profileData.facebookid),
                        address: this.pickFirstProfileValue(profileData.address, profileData.Address),
                        schoolCollege,
                        group: this.pickEnumProfileValue(['Science', 'Arts', 'Commerce'], profileData.group),
                        guardianName: this.pickFirstProfileValue(profileData.guardianName),
                        guardianMobile: this.pickFirstProfileValue(profileData.guardianMobile),
                        relationWithGuardian: this.pickFirstProfileValue(profileData.relationWithGuardian),
                        gender: this.pickFirstProfileValue(profileData.gender),
                        classLevel,
                        version: this.pickEnumProfileValue(['Bangla', 'English'], profileData.version),
                        department: profileData.department || null,
                        phone_changed_at: profileData.phone_changed_at || null,
                        email_changed_at: profileData.email_changed_at || null
                    }
                }
            };
        } catch (error) {
            console.error('Error in getUserProfileForCheckout:', error);
            return {
                success: false,
                error: 'Failed to fetch user profile'
            };
        }
    }

    /**
     * Update user profile for checkout modal
     * Email remains the canonical login identifier.
     */
    updateUserProfileForCheckout = async (userId, updateData) => {
        try {
            // 1. Get current user and existing data
            const currentUserQuery = `
                SELECT id, email, phone, password, profile
                FROM managerial_auth
                WHERE id = $1
            `;
            const currentUserResult = await this.query(currentUserQuery, [userId]);
            
            if (!currentUserResult.success || currentUserResult.data.length === 0) {
                return { 
                    success: false, 
                    error: 'User not found' 
                };
            }
            
            const currentUser = currentUserResult.data[0];
            const { safeProfile: currentProfile, authProviders, passwordSet } = this.getAuthMetadata(
                currentUser.profile,
                Boolean(currentUser.password)
            );
            
            // 2. Enforce business rules
            const {
                name,
                email,
                phone,
                facebookId,
                address,
                schoolCollege,
                group,
                guardianName,
                guardianMobile,
                relationWithGuardian,
                gender,
                classLevel,
                version,
                department
            } = updateData;
            
            // Email is the canonical login identifier and cannot be changed here.
            if (email && email !== currentUser.email) {
                return {
                    success: false,
                    error: 'Cannot update email from this form.'
                };
            }

            let finalEmail = currentUser.email;

            // Phone changes require OTP verification via PUT /user/profile/phone
            const finalPhone = currentUser.phone;
            
            // 3. Prepare profile JSONB data
            const updatedProfile = {
                ...currentProfile,
                auth_providers: authProviders,
                password_set: passwordSet,
                facebookId: this.pickFirstProfileValue(facebookId, currentProfile.facebookId, currentProfile.facebookid),
                address: this.pickFirstProfileValue(address, currentProfile.address, currentProfile.Address),
                schoolCollege: this.pickFirstProfileValue(
                    schoolCollege,
                    currentProfile.schoolCollege
                ),
                group: this.pickEnumProfileValue(['Science', 'Arts', 'Commerce'], group, currentProfile.group),
                guardianName: this.pickFirstProfileValue(guardianName, currentProfile.guardianName),
                guardianMobile: this.pickFirstProfileValue(guardianMobile, currentProfile.guardianMobile),
                relationWithGuardian: this.pickFirstProfileValue(
                    relationWithGuardian,
                    currentProfile.relationWithGuardian
                ),
                gender: this.pickFirstProfileValue(gender, currentProfile.gender),
                classLevel: this.pickEnumProfileValue(
                    ['JSC', 'SSC', 'HSC'],
                    classLevel,
                    currentProfile.classLevel
                ),
                version: this.pickEnumProfileValue(['Bangla', 'English'], version, currentProfile.version),
                department: this.pickFirstProfileValue(department, currentProfile.department)
            };
            
            // 4. Update database
            const updateQuery = `
                UPDATE managerial_auth
                SET 
                    name = COALESCE($1, name),
                    email = COALESCE($2, email),
                    login = COALESCE($2, login),
                    phone = COALESCE($3, phone),
                    profile = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING id, name, email, phone, login, password, profile
            `;
            
            const updateResult = await this.query(updateQuery, [
                name || null,
                finalEmail || null,
                finalPhone || null,
                JSON.stringify(updatedProfile),
                userId
            ]);
            
            if (!updateResult.success || updateResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Failed to update profile'
                };
            }
            
            const updatedUser = updateResult.data[0];
            const { safeProfile: updatedProfileData, authProviders: updatedAuthProviders, passwordSet: updatedPasswordSet } =
                this.getAuthMetadata(updatedUser.profile, Boolean(updatedUser.password));
            
            // 5. Return formatted response
            return {
                success: true,
                data: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    auth_providers: updatedAuthProviders,
                    has_password: updatedPasswordSet,
                    profile: {
                        email: updatedUser.email || null,
                        phone: updatedUser.phone || null,
                        facebookId: updatedProfileData.facebookId || null,
                        address: updatedProfileData.address || null,
                        schoolCollege: updatedProfileData.schoolCollege || null,
                        group: updatedProfileData.group || null,
                        guardianName: updatedProfileData.guardianName || null,
                        guardianMobile: updatedProfileData.guardianMobile || null,
                        relationWithGuardian: updatedProfileData.relationWithGuardian || null,
                        gender: updatedProfileData.gender || null,
                        classLevel: updatedProfileData.classLevel || null,
                        version: updatedProfileData.version || null,
                        department: updatedProfileData.department || null,
                        phone_changed_at: updatedProfileData.phone_changed_at || null,
                        email_changed_at: updatedProfileData.email_changed_at || null
                    }
                },
                message: 'Profile updated successfully'
            };
        } catch (error) {
            console.error('Error in updateUserProfileForCheckout:', error);
            return {
                success: false,
                error: 'Failed to update profile'
            };
        }
    }

    changePassword = async (userId, currentPassword, newPassword) => {
        try {
            if (!newPassword || `${newPassword}`.trim().length < 6) {
                return {
                    success: false,
                    error: 'New password must be at least 6 characters long'
                };
            }

            const userResult = await this.query(
                `
                    SELECT id, password, profile
                    FROM managerial_auth
                    WHERE id = $1
                `,
                [userId]
            );

            if (!userResult.success || userResult.data.length === 0) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            const user = userResult.data[0];
            const { safeProfile, authProviders, passwordSet } = this.getAuthMetadata(
                user.profile,
                Boolean(user.password)
            );

            if (passwordSet) {
                if (!currentPassword) {
                    return {
                        success: false,
                        error: 'Current password is required'
                    };
                }

                const matches = await bcrypt.compare(currentPassword, user.password);
                if (!matches) {
                    return {
                        success: false,
                        error: 'Current password is incorrect'
                    };
                }
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            const updatedProfile = {
                ...safeProfile,
                password_set: true,
                auth_providers: [...new Set([...authProviders, 'password'])]
            };

            const updateResult = await this.query(
                `
                    UPDATE managerial_auth
                    SET password = $1, profile = $2, updated_at = NOW()
                    WHERE id = $3
                `,
                [hashedPassword, JSON.stringify(updatedProfile), userId]
            );

            if (!updateResult.success) {
                return {
                    success: false,
                    error: 'Failed to update password'
                };
            }

            return {
                success: true,
                message: passwordSet ? 'Password changed successfully' : 'Password set successfully'
            };
        } catch (error) {
            console.error('Error in changePassword:', error);
            return {
                success: false,
                error: 'Failed to update password'
            };
        }
    }

    changePhone = async (userId, newPhone, otp) => {
        try {
            if (!newPhone || !otp) {
                return { success: false, error: 'New phone number and OTP are required' };
            }

            if (!isValidPhone(newPhone)) {
                return { success: false, error: 'Invalid phone number. Must be 11 digits starting with 01' };
            }

            const normalizedPhone = normalizeContact(newPhone);

            const verifyResult = await authService.verifyOTP(normalizedPhone, otp, true);
            if (!verifyResult.success) {
                return verifyResult;
            }

            const duplicateCheck = await this.query(
                `SELECT id FROM managerial_auth WHERE phone = $1 AND id != $2`,
                [normalizedPhone, userId]
            );
            if (duplicateCheck.data.length > 0) {
                return { success: false, error: 'An account already exists with this phone' };
            }

            const currentUser = await this.query(
                `SELECT id, phone, profile FROM managerial_auth WHERE id = $1`,
                [userId]
            );
            if (!currentUser.success || currentUser.data.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const user = currentUser.data[0];
            const { safeProfile } = this.getAuthMetadata(user.profile, true);

            if (safeProfile.phone_changed_at) {
                const lastChanged = new Date(safeProfile.phone_changed_at);
                const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince < CHANGE_COOLDOWN_DAYS) {
                    const remaining = Math.ceil(CHANGE_COOLDOWN_DAYS - daysSince);
                    return { success: false, error: `Phone number can only be changed once every ${CHANGE_COOLDOWN_DAYS} days. Try again in ${remaining} day(s).` };
                }
            }

            const updatedProfile = { ...safeProfile, phone_verified: true, phone_changed_at: new Date().toISOString() };

            const updateResult = await this.query(
                `UPDATE managerial_auth
                 SET phone = $1, login = $1, profile = $2, updated_at = NOW()
                 WHERE id = $3`,
                [normalizedPhone, JSON.stringify(updatedProfile), userId]
            );

            if (!updateResult.success) {
                return { success: false, error: 'Failed to update phone number' };
            }

            return { success: true, message: 'Phone number updated successfully' };
        } catch (error) {
            console.error('Error in changePhone:', error);
            return { success: false, error: 'Failed to update phone number' };
        }
    }
}

module.exports = { ProfileService };
