const Controller = require("../base").Controller;
const { respond, handle } = require('../base');
const ModuleService=require("../../service/managerial/module.js").ModuleService;
const { resolveCourseId, checkCourseAccess, assertCourseAccess } = require("../../util/courseAccessHelpers");

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
        
        const access = await checkCourseAccess(userId, 'module', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }
        
        var result=await moduleService.create(chapterId,req.body)
        return respond(res, result)
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
        return respond(res, result)
    }
    
    getEntry = handle((req) => moduleService.get(req.params.id))
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
