const router = require("express-promise-router")();
const AuthController=require('../../controllers/in/auth').AuthController

const authController=new AuthController()

router.route("/register").post(authController.register);
router.route("/login").post(authController.login);
router.route("/google").post(authController.googleLogin);

module.exports=router
