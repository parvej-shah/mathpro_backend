const Service = require('../base').Service;
const bcrypt=require('bcryptjs');
const { normalizeContact, isValidEmail, isValidPhone } = require('../../util/authHelpers');

class ProfileService extends Service {
    constructor() {
        super();
    }

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
                        email: profileData.email || user.email || null,
                        phone: profileData.phone || user.phone || null,
                        currentInstitution: profileData.currentInstitution || null,
                        department: profileData.department || null,
                        currentAcademicLevel: profileData.currentAcademicLevel || null
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
            const { name, email, phone, currentInstitution, department, currentAcademicLevel } = updateData;
            
            // Email is the canonical login identifier and cannot be changed here.
            if (email && email !== currentUser.email) {
                return {
                    success: false,
                    error: 'Cannot update email from this form.'
                };
            }

            let finalEmail = currentUser.email;

            let finalPhone = currentUser.phone;
            if (phone && phone !== currentUser.phone) {
                if (!isValidPhone(phone)) {
                    return {
                        success: false,
                        error: 'Invalid phone number. Must be 11 digits starting with 01'
                    };
                }
                finalPhone = normalizeContact(phone);
            }
            
            // 3. Prepare profile JSONB data
            const updatedProfile = {
                ...currentProfile,
                auth_providers: authProviders,
                password_set: passwordSet,
                email: finalEmail || currentProfile.email || null,
                phone: finalPhone || currentProfile.phone || null,
                currentInstitution: currentInstitution || currentProfile.currentInstitution || null,
                department: department || currentProfile.department || null,
                currentAcademicLevel: currentAcademicLevel || currentProfile.currentAcademicLevel || null
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
                        email: updatedProfileData.email || updatedUser.email || null,
                        phone: updatedProfileData.phone || updatedUser.phone || null,
                        currentInstitution: updatedProfileData.currentInstitution || null,
                        department: updatedProfileData.department || null,
                        currentAcademicLevel: updatedProfileData.currentAcademicLevel || null
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
}

module.exports = { ProfileService };
