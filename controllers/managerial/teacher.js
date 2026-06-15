const Controller = require("../base").Controller;
const TeacherService=require("../../service/managerial/teacher").TeacherService

const teacherService=new TeacherService()

class TeacherController extends Controller {
    constructor() {
        super();
    }
    list =async (req,res)=>{
        var result=await teacherService.list()
        return res.status(result.success?200:400).json(result)
    }
    create =async (req,res)=>{
        var result=await teacherService.create(req.body)
        return res.status(result.success?200:400).json(result)
    }
    update =async (req,res)=>{
        var result=await teacherService.update(req.params.id,req.body)
        return res.status(result.success?200:400).json(result)
    }
    deleteEntry =async (req,res)=>{
        var result=await teacherService.deleteEntry(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
    forgotPassword =async (req,res)=>{
        var result=await teacherService.forgotPass(req.params.id)
        return res.status(result.success?200:400).json(result)
    }

    getTeacher =async (req,res)=>{
        var result=await teacherService.getTeacher(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
}

module.exports={TeacherController}

