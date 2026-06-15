const Controller = require("../base").Controller;
const ProfileService = require("../../service/user/profile").ProfileService;

const profileService = new ProfileService();

class ProfileController extends Controller {
    constructor() {
        super();
    }

    /**
     * GET /user/profile
     * Get current user's profile for checkout modal
     * Authentication: Required (Bearer token)
     */
    getProfile = async (req, res) => {
        try {
            const userId = req.body.user_id; // Set by authenticateUser middleware
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }
            
            const result = await profileService.getUserProfileForCheckout(userId);
            
            if (!result.success) {
                return res.status(result.error === 'User not found' ? 404 : 400).json(result);
            }
            
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in getProfile controller:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * PUT /user/profile
     * Update current user's profile for checkout modal
     * Authentication: Required (Bearer token)
     */
    updateProfile = async (req, res) => {
        try {
            const userId = req.body.user_id; // Set by authenticateUser middleware
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }
            
            const { name, email, phone, currentInstitution, department, currentAcademicLevel } = req.body;
            
            // Basic validation (frontend handles most validation, but we check required fields)
            if (!name || name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Name is required'
                });
            }
            
            const updateData = {
                name: name.trim(),
                email: email ? email.trim() : null,
                phone: phone ? phone.trim() : null,
                currentInstitution: currentInstitution ? currentInstitution.trim() : null,
                department: department ? department.trim() : null,
                currentAcademicLevel: currentAcademicLevel ? currentAcademicLevel.toUpperCase() : null
            };
            
            const result = await profileService.updateUserProfileForCheckout(userId, updateData);
            
            if (!result.success) {
                return res.status(400).json(result);
            }
            
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in updateProfile controller:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * PUT /user/profile/password
     * Set or change current user's password
     * Authentication: Required (Bearer token)
     */
    changePassword = async (req, res) => {
        try {
            const userId = req.body.user_id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }

            const { currentPassword, newPassword } = req.body;

            if (!newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'New password is required'
                });
            }

            const result = await profileService.changePassword(userId, currentPassword, newPassword);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in changePassword controller:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
}

module.exports = { ProfileController };
