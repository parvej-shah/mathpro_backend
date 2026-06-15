const Controller = require("../base.js").Controller;
const LevelService=require("../../service/managerial/level.js").LevelService;
const { checkCourseAccess, assertCourseAccess, getAccessibleCourseIds } = require("../../util/courseAccessHelpers");

const levelService=new LevelService()

class LevelController extends Controller {
    constructor() {
        super();
    }
    list =async (req,res)=>{
        var result=await levelService.list(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
    create =async (req,res)=>{
        const courseId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Check course access for create operation (courseId is in params)
        const access = await checkCourseAccess(userId, 'level', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }
        
        var result=await levelService.create(courseId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    update =async (req,res)=>{
        const levelId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'level', 'manage', 'level', levelId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Level not found' : 'No access to this course'
            });
        }
        
        var result=await levelService.update(levelId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    getEntry =async (req,res)=>{
        var result=await levelService.get(req.params.id)
        return res.status(result.success?200:400).json(result)
    }
    deleteEntry =async (req,res)=>{
        const levelId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'level', 'manage', 'level', levelId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Level not found' : 'No access to this course'
            });
        }
        
        var result=await levelService.deleteEntry(levelId)
        return res.status(result.success?200:400).json(result)
    }

    requestGift =async (req,res)=>{
        var result=await levelService.requestGift(parseInt(req.params.level_id),req.body.user_id)
        return res.status(result.success?200:400).json(result)
    }

    getGiftRequests =async (req,res)=>{
        const userId = req.user.id;
        const access = await getAccessibleCourseIds(userId, 'level', 'manage');
        var result=await levelService.getGiftRequests(access)
        return res.status(result.success?200:400).json(result)
    }

    approveGift =async (req,res)=>{
        var result=await levelService.approveGift(req.body.level_id,req.body.reciever_user_id)
        return res.status(result.success?200:400).json(result)
    }

    getGiftPage =async (req,res)=>{
        var result=await levelService.getGiftsPage(req.body.user_id,parseInt(req.params.course_id))
        return res.status(result.success?200:400).json(result)
    }

}

module.exports={LevelController}

