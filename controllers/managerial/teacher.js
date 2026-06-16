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
        if (!result.success) {
            const err = result.error;
            const message = (err && (err.detail || err.message)) || 'Failed to delete teacher';
            return res.status(400).json({ success: false, error: message });
        }
        return res.status(200).json(result)
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

