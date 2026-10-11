const Controller = require("../base").Controller;
const { handle } = require('../base');
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
    requestOTP = handle((req) => authService.requestOTP(req.body.contact, 'registration'));

    /**
     * Verify an OTP without consuming it for a specific action.
     * POST /admin/auth/verify-otp
     * Body: { contact: string, otp: string }
     */
    verifyOTP = handle((req) => authService.verifyOTP(req.body.contact, req.body.otp, false));

    /**
     * Register with phone (or email). OTP required.
     * POST /admin/auth/register
     * Body: { login: string, password: string, otp: string, name?: string }
     */
    register = async (req, res) => {
        const result = await authService.register(req.body, getDeviceInfo(req));
        return res.status(result.success ? 201 : 400).json(result);
    }

    /**
     * Login with phone or email
     * POST /admin/auth/login
     * Body: { login: string, password: string }
     */
    login = handle((req) => authService.login(req.body, getDeviceInfo(req)));

    /**
     * Login with Google
     * POST /admin/auth/google
     * Body: { id_token: string }
     */
    googleLogin = handle((req) => authService.googleLogin(req.body, getDeviceInfo(req)));

    /**
     * Link a phone + password to the logged-in account (Google-first users).
     * POST /admin/auth/link-phone  (authenticated)
     * Body: { phone: string, password: string, otp: string }
     */
    linkPhone = handle((req) => authService.linkPhone(req.body.user_id, req.body));

    /**
     * Connect (or change) the Google-verified email on the logged-in account.
     * POST /admin/auth/connect-google  (authenticated)
     * Body: { id_token: string }
     */
    connectGoogle = handle((req) => authService.connectGoogle(req.body.user_id, req.body));

    /**
     * Logout the current device (revoke this session).
     * POST /admin/auth/logout  (authenticated)
     */
    logout = handle((req) => authService.revokeSession(req.body.user_id, req.user?.sid));

    /**
     * List active sessions (devices) for the logged-in user.
     * GET /admin/auth/sessions  (authenticated)
     */
    getSessions = handle((req) => authService.listSessions(req.body.user_id));

    /**
     * Request OTP for password reset (phone or email)
     * POST /admin/auth/forgot-password
     * Body: { contact: string }
     */
    requestPasswordResetOTP = handle((req) => authService.requestOTP(req.body.contact, 'password_reset'));
    
    /**
     * Reset password with OTP
     * POST /admin/auth/reset-password
     * Body: { contact: string, otp: string, newPassword: string } where contact is an email
     */
    resetPassword = handle((req) => authService.resetPasswordWithOTP(req.body.contact, req.body.otp, req.body.newPassword));

    getProfile = handle((req) => authService.getProfile(req.body.user_id))

    setProfile = handle((req) => authService.setProfile(req.body.user_id,req.body.name,req.body.profile))
}

module.exports={AuthController}
