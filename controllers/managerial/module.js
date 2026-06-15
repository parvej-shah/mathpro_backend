const Controller = require("../base").Controller;
const ModuleService=require("../../service/managerial/module.js").ModuleService;
const { resolveCourseId, checkCourseAccess, assertCourseAccess } = require("../../util/courseAccessHelpers");

const moduleService=new ModuleService()

class ModuleController extends Controller {
    constructor() {
        super();
    }
    list =async (req,res)=>{
        var result=await moduleService.list(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
    create =async (req,res)=>{
        const chapterId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Resolve chapterId to courseId and check access
        const courseId = await resolveCourseId('chapter', chapterId);
        if (!courseId) {
            return res.status(404).json({
                success: false,
                error: 'CHAPTER_NOT_FOUND',
                message: 'Chapter not found'
            });
        }
        
        const access = await checkCourseAccess(userId, 'module', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }
        
        var result=await moduleService.create(chapterId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    update =async (req,res)=>{
        const moduleId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'module', 'manage', 'module', moduleId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Module not found' : 'No access to this course'
            });
        }
        
        var result=await moduleService.update(moduleId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    
    getEntry =async (req,res)=>{
        var result=await moduleService.get(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
    deleteEntry =async (req,res)=>{
        const moduleId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'module', 'manage', 'module', moduleId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Module not found' : 'No access to this course'
            });
        }
        
        var result=await moduleService.deleteEntry(moduleId)
        return res.status(result.success?200:400).json(result)
    }
    addProgress =async (req,res)=>{
        var result=await moduleService.completeModule(
            req.body.user_id,
            req.params.id,
            parseInt(req.query.points),
            req.query.type
        )
        return res.status(result.success?200:400).json(result)
    }
    getEntryUser =async (req,res)=>{
        var result=await moduleService.get(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
    getLiveModules =async (req,res)=>{
        var result=await moduleService.getLiveModulesForUser(req.user.id)
        return res.status(result.success?200:400).json(result)
    }
    getLiveModulesForCourse =async (req,res)=>{
        var result=await moduleService.getLiveModulesForCourse(req.user.id, req.params.courseId)
        return res.status(result.success?200:400).json(result)
    }

    
}

module.exports={ModuleController}
