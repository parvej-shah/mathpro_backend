const Controller = require("../base").Controller;
const { respond } = require('../base');
const TeacherService=require("../../service/managerial/teacher").TeacherService

const teacherService=new TeacherService()

class TeacherController extends Controller {
    constructor() {
        super();
    }
    list =async (req,res)=>{
        var result=await teacherService.list()
        return respond(res, result)
    }
    create =async (req,res)=>{
        var result=await teacherService.create(req.body)
        return respond(res, result)
    }
    update =async (req,res)=>{
        var result=await teacherService.update(req.params.id,req.body)
        return respond(res, result)
    }
    deleteEntry =async (req,res)=>{
        var result=await teacherService.deleteEntry(req.params.id)
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error || 'Failed to delete teacher' });
        }
        return res.status(200).json(result)
    }
    forgotPassword =async (req,res)=>{
        var result=await teacherService.forgotPass(req.params.id)
        return respond(res, result)
    }

    getTeacher =async (req,res)=>{
        var result=await teacherService.getTeacher(req.params.id)
        return respond(res, result)
    }
}

module.exports={TeacherController}

