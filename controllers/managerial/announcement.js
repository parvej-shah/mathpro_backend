const Controller = require("../base.js").Controller;
const AnnouncementService=require("../../service/managerial/announcement.js").AnnouncementService;
const { checkCourseAccess, assertCourseAccess, getAccessibleCourseIds } = require("../../util/courseAccessHelpers");

const announcementService=new AnnouncementService();

class AnnouncementController extends Controller {
    constructor() {
        super();
    }

    

    getAnnouncements =async (req,res)=>{
        const userId = req.user.id;
        const access = await getAccessibleCourseIds(userId, 'announcement', 'manage');
        var result=await announcementService.getAllAnnouncementsPaginated(parseInt(req.query.limit), parseInt(req.query.offset), access)
        return res.status(result.success?200:400).json(result)
    }
    getAnnouncementsCourseWise =async (req,res)=>{
        const courseId = parseInt(req.params.courseId);
        const userId = req.user.id;

        const access = await checkCourseAccess(userId, 'announcement', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }

        var result=await announcementService.getAllAnnouncementsCourseWisePaginated(courseId, parseInt(req.query.limit), parseInt(req.query.offset))
        return res.status(result.success?200:400).json(result)
    }
    getAnnouncementById =async (req,res)=>{
        const announcementId = parseInt(req.params.id);
        const userId = req.user.id;

        const access = await assertCourseAccess(userId, 'announcement', 'manage', 'announcement', announcementId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Announcement not found' : 'No access to this course'
            });
        }

        var result=await announcementService.getEntry(announcementId)
        return res.status(result.success?200:400).json(result)
    }
    create = async (req,res)=>{
       // console.log("From controller: ",req.body);
        const courseId = parseInt(req.params.courseId);
        const userId = req.user.id;
        
        // Check course access for create operation
        const access = await checkCourseAccess(userId, 'announcement', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }
        
        var result=await announcementService.create(courseId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    delete = async (req,res)=>{
        const announcementId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'announcement', 'manage', 'announcement', announcementId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Announcement not found' : 'No access to this course'
            });
        }
        
        var result=await announcementService.deleteEntry(announcementId)
        return res.status(result.success?200:400).json(result)
    }
    update = async (req,res)=>{
        const announcementId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'announcement', 'manage', 'announcement', announcementId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Announcement not found' : 'No access to this course'
            });
        }
        
        var result=await announcementService.updateEntry(announcementId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    send = async (req,res)=>{
        const announcementId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'announcement', 'manage', 'announcement', announcementId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Announcement not found' : 'No access to this course'
            });
        }
        
        var result=await announcementService.send(announcementId)
        return res.status(result.success?200:400).json(result)
    }
}

module.exports={AnnouncementController}