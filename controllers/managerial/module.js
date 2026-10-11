const Controller = require("../base").Controller;
const { respond, handle } = require('../base');
const ModuleService=require("../../service/managerial/module.js").ModuleService;
const { resolveCourseId } = require("../../util/courseAccessHelpers");
const { denyCourseAccess, denyResourceAccess } = require("../shared/courseAccess");

const moduleService=new ModuleService()

class ModuleController extends Controller {
    constructor() {
        super();
    }
    list = handle((req) => moduleService.list(req.params.id))
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
        
        if (await denyCourseAccess(res, userId, 'module', courseId)) return;
        
        var result=await moduleService.create(chapterId,req.body)
        return respond(res, result)
    }
    update =async (req,res)=>{
        const moduleId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'module', moduleId, 'Module not found')) return;
        
        var result=await moduleService.update(moduleId,req.body)
        return respond(res, result)
    }
    
    getEntry = handle((req) => moduleService.get(req.params.id))
    deleteEntry =async (req,res)=>{
        const moduleId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'module', moduleId, 'Module not found')) return;
        
        var result=await moduleService.deleteEntry(moduleId)
        return respond(res, result)
    }
    addProgress =async (req,res)=>{
        var result=await moduleService.completeModule(
            req.body.user_id,
            req.params.id,
            parseInt(req.query.points),
            req.query.type
        )
        return respond(res, result)
    }
    getEntryUser = handle((req) => moduleService.get(req.params.id))
    getLiveModules = handle((req) => moduleService.getLiveModulesForUser(req.user.id))
    getLiveModulesForCourse = handle((req) => moduleService.getLiveModulesForCourse(req.user.id, req.params.courseId))

    
}

module.exports={ModuleController}
