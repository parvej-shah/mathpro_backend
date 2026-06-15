const { authenticateUser } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const AuthController=require('../../controllers/managerial/auth').AuthController

const authController=new AuthController

router.route("/request-otp").post(authController.requestOTP);
router.route("/register").post(authController.register);
router.route("/login").post(authController.login);
router.route("/google").post(authController.googleLogin);

// Request OTP for password reset
router.route("/forgot-password").post(authController.requestPasswordResetOTP);

// Reset password with OTP
router.route("/reset-password").post(authController.resetPassword);

router.route("/getProfile").get(authenticateUser,authController.getProfile);
router.route("/setProfile").put(authenticateUser,authController.setProfile);

module.exports=router
