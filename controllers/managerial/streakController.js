const StreakService = require('../../service/streakService');

class AdminStreakController {
    constructor() {
        this.streakService = new StreakService();
    }

    /**
     * Get streak analytics for admin dashboard
     * GET /admin/streak/analytics
     */
    getStreakAnalytics = async (req, res) => {
        try {
            const { courseId } = req.query;

            const result = await this.streakService.getStreakAnalytics(courseId);

            if (result.success && result.data.length > 0) {
                const analytics = result.data[0];
                
                res.json({
                    success: true,
                    data: {
                        totalUsers: parseInt(analytics.total_users),
                        averageCurrentStreak: parseFloat(analytics.avg_current_streak || 0).toFixed(2),
                        averageLongestStreak: parseFloat(analytics.avg_longest_streak || 0).toFixed(2),
                        maxStreak: parseInt(analytics.max_streak || 0),
                        activeStreaks: parseInt(analytics.active_streaks),
                        weekPlusStreaks: parseInt(analytics.week_plus_streaks),
                        monthPlusStreaks: parseInt(analytics.month_plus_streaks),
                        engagementRate: analytics.total_users > 0 
                            ? ((analytics.active_streaks / analytics.total_users) * 100).toFixed(2)
                            : 0
                    }
                });
            } else {
                res.json({
                    success: true,
                    data: {
                        totalUsers: 0,
                        averageCurrentStreak: 0,
                        averageLongestStreak: 0,
                        maxStreak: 0,
                        activeStreaks: 0,
                        weekPlusStreaks: 0,
                        monthPlusStreaks: 0,
                        engagementRate: 0
                    }
                });
            }

        } catch (error) {
            console.error('Error in getStreakAnalytics:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Get detailed streak data for a specific user
     * GET /admin/streak/user/:userId
     */
    getUserStreakDetails = async (req, res) => {
        try {
            const { userId } = req.params;

            const result = await this.streakService.getUserStreaks(userId);

            if (result.success) {
                res.json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch user streak details'
                });
            }

        } catch (error) {
            console.error('Error in getUserStreakDetails:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Get course leaderboard (admin version with more details)
     * GET /admin/streak/leaderboard/:courseId
     */
    getAdminCourseLeaderboard = async (req, res) => {
        try {
            const { courseId } = req.params;
            const { limit = 50 } = req.query;

            const result = await this.streakService.getCourseLeaderboard(courseId, parseInt(limit));

            if (result.success) {
                res.json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch admin leaderboard'
                });
            }

        } catch (error) {
            console.error('Error in getAdminCourseLeaderboard:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Manually update a user's streak (admin correction)
     * POST /admin/streak/manual-update
     */
    manualStreakUpdate = async (req, res) => {
        try {
            const { userId, courseId, activityDate } = req.body;

            // Validate required fields
            if (!userId || !courseId || !activityDate) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID, Course ID, and Activity Date are required'
                });
            }

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(activityDate)) {
                return res.status(400).json({
                    success: false,
                    message: 'Activity date must be in YYYY-MM-DD format'
                });
            }

            const result = await this.streakService.updateStreak(userId, courseId, activityDate);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Streak updated successfully',
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to update streak',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('Error in manualStreakUpdate:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Bulk update streaks (for data migration/correction)
     * POST /admin/streak/bulk-update
     */
    bulkStreakUpdate = async (req, res) => {
        try {
            const { updates } = req.body;

            if (!Array.isArray(updates) || updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Updates array is required and must not be empty'
                });
            }

            // Validate each update
            for (const update of updates) {
                if (!update.userId || !update.courseId || !update.activityDate) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each update must have userId, courseId, and activityDate'
                    });
                }
            }

            const result = await this.streakService.bulkUpdateStreaks(updates);

            if (result.success) {
                res.json({
                    success: true,
                    message: `Successfully processed ${updates.length} streak updates`,
                    data: result.results
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to process bulk updates',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('Error in bulkStreakUpdate:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Get streak trends over time
     * GET /admin/streak/trends
     */
    getStreakTrends = async (req, res) => {
        try {
            const { courseId, days = 30 } = req.query;

            let query = `
                SELECT 
                    DATE(updated_at) as date,
                    COUNT(*) as total_updates,
                    COUNT(CASE WHEN current_streak > 0 THEN 1 END) as active_streaks,
                    AVG(current_streak) as avg_streak
                FROM user_course_streaks 
                WHERE updated_at >= NOW() - INTERVAL '${parseInt(days)} days'
            `;

            const params = [];
            if (courseId) {
                query += ' AND course_id = $1';
                params.push(courseId);
            }

            query += ' GROUP BY DATE(updated_at) ORDER BY date DESC';

            const result = await this.streakService.query(query, params);

            if (result.success) {
                res.json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch streak trends'
                });
            }

        } catch (error) {
            console.error('Error in getStreakTrends:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };
}

module.exports = AdminStreakController;