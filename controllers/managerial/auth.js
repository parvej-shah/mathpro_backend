const Controller = require("../base").Controller;
const AuthService=require("../../service/managerial/auth").AuthService

const authService=new AuthService()

// Extract device info from the request for session tracking.
const getDeviceInfo = (req) => ({
    userAgent: req.headers['user-agent'] || '',
    ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || ''
});

class AuthController extends Controller {
    constructor() {
        super();
    }

    /**
     * Request registration OTP by phone or email
     * POST /admin/auth/request-otp
     * Body: { contact: string }
     */
    requestOTP = async (req, res) => {
        const { contact } = req.body;

        if (!contact) {
            return res.status(400).json({
                success: false,
                error: 'Phone number or email is required'
            });
        }

        const result = await authService.requestOTP(contact, 'registration');
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * Verify an OTP without consuming it for a specific action.
     * POST /admin/auth/verify-otp
     * Body: { contact: string, otp: string }
     */
    verifyOTP = async (req, res) => {
        const { contact, otp } = req.body;

        if (!contact || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Contact and OTP are required'
            });
        }

        const result = await authService.verifyOTP(contact, otp);
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * Register with phone (or email). OTP required.
     * POST /admin/auth/register
     * Body: { login: string, password: string, otp: string, name?: string }
     */
    register = async (req, res) => {
        const { login, password, otp } = req.body;

        if (!login || !password || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Login, password and OTP are required'
            });
        }

        const result = await authService.register(req.body, getDeviceInfo(req));
        return res.status(result.success ? 201 : 400).json(result);
    }

    /**
     * Login with phone or email
     * POST /admin/auth/login
     * Body: { login: string, password: string }
     */
    login = async (req, res) => {
        const { login, password } = req.body;

        if (!login || !password) {
            return res.status(400).json({
                success: false,
                error: 'Login and password are required'
            });
        }

        const result = await authService.login(req.body, getDeviceInfo(req));
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * Login with Google
     * POST /admin/auth/google
     * Body: { id_token: string }
     */
    googleLogin = async (req, res) => {
        const { id_token } = req.body;

        if (!id_token) {
            return res.status(400).json({
                success: false,
                error: 'Google id_token is required'
            });
        }

        const result = await authService.googleLogin(req.body, getDeviceInfo(req));
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * Link a phone + password to the logged-in account (Google-first users).
     * POST /admin/auth/link-phone  (authenticated)
     * Body: { phone: string, password: string, otp: string }
     */
    linkPhone = async (req, res) => {
        const { phone, password, otp } = req.body;

        if (!phone || !password || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Phone, password and OTP are required'
            });
        }

        const result = await authService.linkPhone(req.body.user_id, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * Connect (or change) the Google-verified email on the logged-in account.
     * POST /admin/auth/connect-google  (authenticated)
     * Body: { id_token: string }
     */
    connectGoogle = async (req, res) => {
        const { id_token } = req.body;

        if (!id_token) {
            return res.status(400).json({
                success: false,
                error: 'Google id_token is required'
            });
        }

        const result = await authService.connectGoogle(req.body.user_id, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * Logout the current device (revoke this session).
     * POST /admin/auth/logout  (authenticated)
     */
    logout = async (req, res) => {
        const result = await authService.revokeSession(req.body.user_id, req.user?.sid);
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * List active sessions (devices) for the logged-in user.
     * GET /admin/auth/sessions  (authenticated)
     */
    getSessions = async (req, res) => {
        const result = await authService.listSessions(req.body.user_id);
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * Request OTP for password reset (phone or email)
     * POST /admin/auth/forgot-password
     * Body: { contact: string }
     */
    requestPasswordResetOTP = async (req, res) => {
        const { contact } = req.body;

        if (!contact) {
            return res.status(400).json({
                success: false,
                error: 'Phone number or email is required'
            });
        }

        const result = await authService.requestOTP(contact, 'password_reset');
        return res.status(result.success ? 200 : 400).json(result);
    }
    
    /**
     * Reset password with OTP
     * POST /admin/auth/reset-password
     * Body: { contact: string, otp: string, newPassword: string } where contact is an email
     */
    resetPassword = async (req, res) => {
        const { contact, otp, newPassword } = req.body;
        
        if (!contact || !otp || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Contact, OTP, and new password are required'
            });
        }
        
        const result = await authService.resetPasswordWithOTP(contact, otp, newPassword);
        return res.status(result.success ? 200 : 400).json(result);
    }

    getProfile=async (req,res)=>{
        var result=await authService.getProfile(req.body.user_id)
        return res.status(result.success?200:400).json(result)
    }

    setProfile=async (req,res)=>{
        var result=await authService.setProfile(req.body.user_id,req.body.name,req.body.profile)
        return res.status(result.success?200:400).json(result)
    }
}

module.exports={AuthController}
