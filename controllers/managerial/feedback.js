const Controller = require("../base").Controller;
const FeedbackService = require("../../service/feedback").FeedbackService;
const { getAccessibleCourseIds, checkCourseAccess } = require("../../util/courseAccessHelpers");

const feedbackService = new FeedbackService();

class FeedbackController extends Controller {
    constructor() {
        super();
    }

    // Get all feedbacks with filtering and pagination
    getAllFeedbacks = async (req, res) => {
        try {
            const {
                page = 1,
                limit = 20,
                courseId,
                rating,
                category,
                sortBy = 'createdAt',
                order = 'desc'
            } = req.query;

            // Validate limit (max 100)
            const validLimit = Math.min(parseInt(limit), 100);
            
            // Validate rating
            if (rating && (parseInt(rating) < 1 || parseInt(rating) > 5)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid rating value'
                });
            }

            // Validate category
            const validCategories = ['content', 'instructor', 'platform', 'course', 'other'];
            if (category && !validCategories.includes(category)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid category'
                });
            }

            // Validate sortBy
            const validSortFields = ['createdAt', 'rating'];
            if (!validSortFields.includes(sortBy)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid sort field'
                });
            }

            // Validate order
            if (!['asc', 'desc'].includes(order.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid sort order'
                });
            }

            // Get accessible course IDs for filtering
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'feedback', 'manage');

            const filters = {
                page: parseInt(page),
                limit: validLimit,
                courseId,
                rating: rating ? parseInt(rating) : undefined,
                category,
                sortBy,
                order,
                access  // Pass access info to service
            };

            const result = await feedbackService.getAllFeedbacks(filters);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getAllFeedbacks:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    // Get feedback statistics
    getFeedbackStats = async (req, res) => {
        try {
            const { courseId } = req.query;
            
            // Get accessible course IDs for filtering
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'feedback', 'manage');

            if (courseId) {
                const parsedCourseId = parseInt(courseId);
                if (isNaN(parsedCourseId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid course ID'
                    });
                }
                const courseAccess = await checkCourseAccess(userId, 'feedback', 'manage', parsedCourseId);
                if (!courseAccess.hasAccess) {
                    return res.status(403).json({
                        success: false,
                        error: 'NO_COURSE_ACCESS',
                        message: 'No access to this course'
                    });
                }
            }
            
            const result = await feedbackService.getFeedbackStats(courseId, access);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getFeedbackStats:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    // Delete feedback (admin)
    deleteFeedback = async (req, res) => {
        try {
            const { feedbackId } = req.params;
            
            // Check access to the feedback's course
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'feedback', 'manage');
            
            const result = await feedbackService.adminDeleteFeedback(feedbackId, access);
            if (!result.success && result.error === 'NO_COURSE_ACCESS') {
                return res.status(403).json(result);
            }
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in deleteFeedback (admin):', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    // Export feedbacks
    exportFeedbacks = async (req, res) => {
        try {
            const { courseId, startDate, endDate, format = 'csv' } = req.query;

            // Validate dates
            if (startDate && isNaN(Date.parse(startDate))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid start date format'
                });
            }

            if (endDate && isNaN(Date.parse(endDate))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid end date format'
                });
            }

            // Get accessible course IDs for filtering
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'feedback', 'manage');

            if (courseId) {
                const parsedCourseId = parseInt(courseId);
                if (isNaN(parsedCourseId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid course ID'
                    });
                }
                const courseAccess = await checkCourseAccess(userId, 'feedback', 'manage', parsedCourseId);
                if (!courseAccess.hasAccess) {
                    return res.status(403).json({
                        success: false,
                        error: 'NO_COURSE_ACCESS',
                        message: 'No access to this course'
                    });
                }
            }

            const filters = {
                courseId,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                access  // Pass access info to service
            };

            const result = await feedbackService.exportFeedbacks(filters);

            if (!result.success && result.error === 'NO_COURSE_ACCESS') {
                return res.status(403).json(result);
            }

            if (!result.success) {
                return res.status(400).json(result);
            }

            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename="feedbacks.json"');
                return res.json(result.data);
            } else {
                // CSV format
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="feedbacks.csv"');

                // CSV headers
                const headers = [
                    'ID',
                    'Course ID',
                    'Course Name',
                    'User ID',
                    'User Name',
                    'User Email',
                    'Rating',
                    'Comment',
                    'Category',
                    'Created At',
                    'Updated At'
                ];

                let csv = headers.join(',') + '\n';

                // CSV rows
                result.data.forEach(row => {
                    const csvRow = [
                        row.id,
                        row.course_id,
                        `"${(row.course_name || '').replace(/"/g, '""')}"`,
                        row.user_id,
                        `"${(row.user_name || '').replace(/"/g, '""')}"`,
                        row.user_email || '',
                        row.rating,
                        `"${(row.comment || '').replace(/"/g, '""')}"`,
                        row.category || '',
                        row.created_at,
                        row.updated_at
                    ];
                    csv += csvRow.join(',') + '\n';
                });

                return res.send(csv);
            }
        } catch (error) {
            console.error('Error in exportFeedbacks:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };
}

exports.FeedbackController = FeedbackController;
