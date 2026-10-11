const Controller = require("../base.js").Controller;
const { respond } = require('../base');
const { parseLimitOffset } = require('../../util/pagination');

// The admin client's own page size.
const ANNOUNCEMENT_PAGE = { defaultLimit: 100 };
const AnnouncementService=require("../../service/managerial/announcement.js").AnnouncementService;
const { getAccessibleCourseIds } = require("../../util/courseAccessHelpers");
const { denyCourseAccess, denyResourceAccess } = require('../shared/courseAccess');

const announcementService=new AnnouncementService();

class AnnouncementController extends Controller {
    constructor() {
        super();
    }

    

    getAnnouncements =async (req,res)=>{
        const userId = req.user.id;
        const access = await getAccessibleCourseIds(userId, 'announcement', 'manage');
        const { limit, offset } = parseLimitOffset(req.query, ANNOUNCEMENT_PAGE);
        var result=await announcementService.getAllAnnouncementsPaginated(limit, offset, access)
        return respond(res, result)
    }
    getAnnouncementsCourseWise =async (req,res)=>{
        const courseId = parseInt(req.params.courseId);
        const userId = req.user.id;

        if (await denyCourseAccess(res, userId, 'announcement', courseId)) return;

        const { limit, offset } = parseLimitOffset(req.query, ANNOUNCEMENT_PAGE);
        var result=await announcementService.getAllAnnouncementsCourseWisePaginated(courseId, limit, offset)
        return respond(res, result)
    }
    getAnnouncementById =async (req,res)=>{
        const announcementId = parseInt(req.params.id);
        const userId = req.user.id;

        if (await denyResourceAccess(res, userId, 'announcement', announcementId, 'Announcement not found')) return;

        var result=await announcementService.getEntry(announcementId)
        return respond(res, result)
    }
    create = async (req,res)=>{
       // console.log("From controller: ",req.body);
        const courseId = parseInt(req.params.courseId);
        const userId = req.user.id;
        
        // Check course access for create operation
        if (await denyCourseAccess(res, userId, 'announcement', courseId)) return;
        
        var result=await announcementService.create(courseId,req.body)
        return respond(res, result)
    }
    delete = async (req,res)=>{
        const announcementId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'announcement', announcementId, 'Announcement not found')) return;
        
        var result=await announcementService.deleteEntry(announcementId)
        return respond(res, result)
    }
    update = async (req,res)=>{
        const announcementId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'announcement', announcementId, 'Announcement not found')) return;
        
        var result=await announcementService.updateEntry(announcementId,req.body)
        return respond(res, result)
    }
    send = async (req,res)=>{
        const announcementId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        if (await denyResourceAccess(res, userId, 'announcement', announcementId, 'Announcement not found')) return;
        
        var result=await announcementService.send(announcementId)
        return respond(res, result)
    }
}

module.exports={AnnouncementController}