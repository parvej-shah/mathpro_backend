const Controller = require("../base").Controller;
const ChapterService=require("../../service/managerial/chapter.js").ChapterService;
const { checkCourseAccess, assertCourseAccess } = require("../../util/courseAccessHelpers");

const chapterService=new ChapterService()

class ChapterController extends Controller {
    constructor() {
        super();
    }
    list =async (req,res)=>{
        var result=await chapterService.list(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
    create =async (req,res)=>{
        const courseId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Check course access for create operation (courseId is in params)
        const access = await checkCourseAccess(userId, 'chapter', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }
        
        var result=await chapterService.create(courseId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    update =async (req,res)=>{
        const chapterId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'chapter', 'manage', 'chapter', chapterId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Chapter not found' : 'No access to this course'
            });
        }
        
        var result=await chapterService.update(chapterId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    getEntry =async (req,res)=>{
        var result=await chapterService.get(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
    deleteEntry =async (req,res)=>{
        const chapterId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'chapter', 'manage', 'chapter', chapterId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Chapter not found' : 'No access to this course'
            });
        }
        
        var result=await chapterService.deleteEntry(chapterId)
        return res.status(result.success?200:400).json(result)
    }
}

module.exports={ChapterController}

