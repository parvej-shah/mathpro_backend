const Controller = require("../base").Controller;
const { respond, handle } = require('../base');
const ChapterService=require("../../service/managerial/chapter.js").ChapterService;
const { denyCourseAccess, denyResourceAccess } = require("../shared/courseAccess");

const chapterService=new ChapterService()

class ChapterController extends Controller {
    constructor() {
        super();
    }
    list = handle((req) => chapterService.list(req.params.id))
    create =async (req,res)=>{
        const courseId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Check course access for create operation (courseId is in params)
        if (await denyCourseAccess(res, userId, 'chapter', courseId)) return;
        
        var result=await chapterService.create(courseId,req.body)
        return respond(res, result)
    }
    update =async (req,res)=>{
        const chapterId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'chapter', chapterId, 'Chapter not found')) return;
        
        var result=await chapterService.update(chapterId,req.body)
        return respond(res, result)
    }
    getEntry = handle((req) => chapterService.get(req.params.id))
    deleteEntry =async (req,res)=>{
        const chapterId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'chapter', chapterId, 'Chapter not found')) return;
        
        var result=await chapterService.deleteEntry(chapterId)
        return respond(res, result)
    }
}

module.exports={ChapterController}

