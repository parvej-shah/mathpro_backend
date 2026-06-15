const Controller = require("../base").Controller;
const RevenueService = require("../../service/managerial/revenueService").RevenueService;
const { checkCourseAccess, getAccessibleCourseIds } = require("../../util/courseAccessHelpers");

const revenueService = new RevenueService();

class RevenueController extends Controller {
  constructor() {
    super();
  }
  
  getDetailedRevenue = async (req, res) => {
    const courseId = req.params.id ? parseInt(req.params.id) : null;
    const userId = req.user.id;
    
    // If specific courseId is provided, check access to that course
    if (courseId) {
      const access = await checkCourseAccess(userId, 'revenue', 'manage', courseId);
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'NO_COURSE_ACCESS',
          message: 'No access to this course'
        });
      }
    } else {
      // For overall revenue, filter by accessible courses
      const access = await getAccessibleCourseIds(userId, 'revenue', 'manage');
      const result = await revenueService.getDetailedRevenue(null, access);
      return res.status(result.success ? 200 : 500).json(result);
    }
    
    const result = await revenueService.getDetailedRevenue(courseId);
    return res.status(result.success ? 200 : 500).json(result);
  };
  
  getRevenueByTimeframe = async (req, res) => {
    const period = req.query.period || 'year';
    const validPeriods = ['week', 'month', 'year', 'all'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid period. Must be one of: week, month, year, all' 
      });
    }
    
    // Get accessible course IDs for filtering
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, 'revenue', 'manage');
    
    const result = await revenueService.getRevenueByTimeframe(period, access);
    return res.status(result.success ? 200 : 500).json(result);
  };
  
  getTopRevenueGenerators = async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be a number between 1 and 100'
      });
    }
    
    // Get accessible course IDs for filtering
    const userId = req.user.id;
    const access = await getAccessibleCourseIds(userId, 'revenue', 'manage');
    
    const result = await revenueService.getTopRevenueGenerators(limit, access);
    return res.status(result.success ? 200 : 500).json(result);
  };
}

exports.RevenueController = RevenueController; 
