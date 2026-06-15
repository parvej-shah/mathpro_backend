const Controller = require("../base").Controller;
const AnnouncementService = require("../../service/user/announcement").AnnouncementService;

const announcementService = new AnnouncementService();

class AnnouncementController extends Controller {
  constructor() {
    super();
  }

  getAnnouncementsByCourse = async (req, res) => {
    try {
      const userId = req.body.user_id;
      const courseId = parseInt(req.params.courseId);
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;

      // Get announcements
      const announcementsResult = await announcementService.getAnnouncementsByCourse(
        userId,
        courseId,
        limit,
        offset
      );

      if (!announcementsResult.success) {
        return res.status(400).json(announcementsResult);
      }

      // Get total count
      const countResult = await announcementService.getTotalCount(userId, courseId);
      const totalCount = countResult.success && countResult.data.length > 0 
        ? parseInt(countResult.data[0].count) 
        : 0;

      // Transform response
      const announcements = announcementsResult.data.map(announcement => ({
        id: announcement.id,
        title: announcement.subject,
        content: announcement.description,
        created_date: new Date(announcement.created_at * 1000).toISOString()
      }));

      return res.status(200).json({
        success: true,
        data: {
          announcements: announcements,
          total_count: totalCount
        }
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };
}

module.exports = { AnnouncementController };
