const Controller = require("../base").Controller;
const { respond, catchAs } = require('../base');
const FeedbackService = require("../../service/feedback").FeedbackService;

const feedbackService = new FeedbackService();

class FeedbackController extends Controller {
    constructor() {
        super();
    }

    // Submit feedback
    submitFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { courseId, rating, comment, category } = req.body;
        const userId = req.body.user_id.toString();

        // Validate required fields
        if (!courseId || !rating) {
            return res.status(400).json({
                success: false,
                error: 'Course ID and rating are required'
            });
        }

        // Validate comment length
        if (comment && comment.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Comment must be 500 characters or less'
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

        const result = await feedbackService.submitFeedback({
            courseId,
            userId,
            rating,
            comment,
            category
        });

        return res.status(result.success ? 201 : 400).json(result);
    });

    // Check user feedback status
    checkFeedbackStatus = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { userId, courseId } = req.params;
        const requestUserId = req.body.user_id.toString();

        // Users can only check their own feedback status
        if (userId !== requestUserId) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const result = await feedbackService.checkUserFeedback(userId, courseId);
        return respond(res, result);
    });

    // Get course feedbacks (paginated)
    getCourseFeedbacks = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { courseId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 per page

        const result = await feedbackService.getCourseFeedbacks(courseId, page, limit);
        return respond(res, result);
    });

    // Update feedback
    updateFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { feedbackId } = req.params;
        const { rating, comment, category } = req.body;
        const userId = req.body.user_id.toString();

        // Validate comment length
        if (comment && comment.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Comment must be 500 characters or less'
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

        const updateData = {};
        if (rating !== undefined) updateData.rating = rating;
        if (comment !== undefined) updateData.comment = comment;
        if (category !== undefined) updateData.category = category;

        const result = await feedbackService.updateFeedback(feedbackId, userId, updateData);
        
        if (!result.success && result.error === 'Unauthorized to update this feedback') {
            return res.status(403).json(result);
        }

        return respond(res, result);
    });

    // Delete feedback
    deleteFeedback = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const { feedbackId } = req.params;
        const userId = req.body.user_id.toString();

        const result = await feedbackService.deleteFeedback(feedbackId, userId);
        
        if (!result.success && result.error === 'Unauthorized to delete this feedback') {
            return res.status(403).json(result);
        }

        return respond(res, result);
    });
}

exports.FeedbackController = FeedbackController;