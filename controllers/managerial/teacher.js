const Controller = require("../base").Controller;
const { handle } = require('../base');
const TeacherService=require("../../service/managerial/teacher").TeacherService

const teacherService=new TeacherService()

class TeacherController extends Controller {
    constructor() {
        super();
    }
    list = handle(() => teacherService.list())
    create = handle((req) => teacherService.create(req.body))
    update = handle((req) => teacherService.update(req.params.id,req.body))
    deleteEntry =async (req,res)=>{
        var result=await teacherService.deleteEntry(req.params.id)
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error || 'Failed to delete teacher' });
        }
        return res.status(200).json(result)
    }
    forgotPassword = handle((req) => teacherService.forgotPass(req.params.id))

    getTeacher = handle((req) => teacherService.getTeacher(req.params.id))
}

module.exports={TeacherController}

