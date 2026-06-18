const { authenticateUser } = require("../../service/authMiddleWares");
const { identifierLimiter, ipLimiter, actorLimiter } = require("../../util/rateLimitPolicies");

const router = require("express-promise-router")();
const AuthController=require('../../controllers/managerial/auth').AuthController

const authController=new AuthController

const authIdentifierLimit = identifierLimiter(
  "auth:identifier",
  5,
  15 * 60 * 1000,
  { message: "Too many authentication attempts. Please try again later." }
);

const authLoginLimit = identifierLimiter(
  "auth:login",
  8,
  15 * 60 * 1000,
  { message: "Too many login attempts. Please try again later." }
);

const authGoogleLimit = ipLimiter(
  "auth:google",
  10,
  15 * 60 * 1000,
  { message: "Too many Google login attempts. Please try again later." }
);

const authSessionLimit = actorLimiter(
  "auth:session",
  20,
  15 * 60 * 1000,
  { message: "Too many account operations. Please try again later." }
);

router.route("/request-otp").post(authIdentifierLimit, authController.requestOTP);
router.route("/verify-otp").post(authIdentifierLimit, authController.verifyOTP);
router.route("/register").post(authIdentifierLimit, authController.register);
router.route("/login").post(authLoginLimit, authController.login);
router.route("/google").post(authGoogleLimit, authController.googleLogin);

// Request OTP for password reset
router.route("/forgot-password").post(authIdentifierLimit, authController.requestPasswordResetOTP);

// Reset password with OTP
router.route("/reset-password").post(authIdentifierLimit, authController.resetPassword);

// Link a phone + password to a Google-first account
router.route("/link-phone").post(authenticateUser, authSessionLimit, authController.linkPhone);

// Connect / change the Google-verified email on the account
router.route("/connect-google").post(authenticateUser, authSessionLimit, authController.connectGoogle);

// Session management (devices)
router.route("/logout").post(authenticateUser, authSessionLimit, authController.logout);
router.route("/sessions").get(authenticateUser, authSessionLimit, authController.getSessions);

router.route("/getProfile").get(authenticateUser, authSessionLimit, authController.getProfile);
router.route("/setProfile").put(authenticateUser, authSessionLimit, authController.setProfile);

module.exports=router
