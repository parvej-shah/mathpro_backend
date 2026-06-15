const Controller = require("../base").Controller;
const AuthService=require("../../service/in/auth").AuthService

const authService=new AuthService()

class AuthController extends Controller {
    constructor() {
        super();
    }

    register=async (req,res)=>{
        var registerResult=await authService.register(req.body)
        return res.status(registerResult.success?200:400).json(registerResult)
    }

    login=async (req,res)=>{
        var loginResult=await authService.login(req.body)
        return res.status(loginResult.success?200:400).json(loginResult)
    }

    googleLogin=async (req,res)=>{
        var loginResult=await authService.googleLogin(req.body)
        return res.status(loginResult.success?200:400).json(loginResult)
    }
}

module.exports={AuthController}
