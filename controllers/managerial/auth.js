const Controller = require("../base").Controller;
const AuthService=require("../../service/managerial/auth").AuthService

const authService=new AuthService()

class AuthController extends Controller {
    constructor() {
        super();
    }
    
    /**
     * Request registration OTP by email
     * POST /admin/auth/request-otp
     * Body: { contact: string }
     */
    requestOTP = async (req, res) => {
        const { contact } = req.body;
        
        if (!contact) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }
        
        const result = await authService.requestOTP(contact, 'registration');
        return res.status(result.success ? 200 : 400).json(result);
    }

    /**
     * Register with email
     * POST /admin/auth/register
     * Body: { login: string, password: string, name?: string }
     */
    register = async (req, res) => {
        const { login, password } = req.body;
        
        if (!login || !password) {
            return res.status(400).json({
                success: false,
                error: 'Login and password are required'
            });
        }
        
        const result = await authService.register(req.body);
        return res.status(result.success ? 201 : 400).json(result);
    }
    
    /**
     * Login with email
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
        
        const result = await authService.login(req.body);
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

        const result = await authService.googleLogin(req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }
    
    /**
     * Request OTP for password reset
     * POST /admin/auth/forgot-password
     * Body: { contact: string } where contact is an email
     */
    requestPasswordResetOTP = async (req, res) => {
        const { contact } = req.body;
        
        if (!contact) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
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
