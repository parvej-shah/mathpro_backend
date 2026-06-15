const StreakService = require('../../service/streakService');
const jwt = require('jsonwebtoken');

class StreakController {
    constructor() {
        this.streakService = new StreakService();
    }

    /**
     * Record lesson completion and update streak
     * POST /user/streak/complete-lesson
     */
    completeLessonStreak = async (req, res) => {
        try {
            const { courseId, timezone = 'UTC' } = req.body;
            const userId = req.body.user_id; // From auth middleware

            // Validate required fields
            if (!courseId) {
                return res.status(400).json({
                    success: false,
                    message: 'Course ID is required'
                });
            }

            // Calculate activity date in user's timezone
            const now = new Date();
            const userDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
            const activityDate = userDate.toISOString().split('T')[0]; // YYYY-MM-DD

            // Update streak
            const result = await this.streakService.updateStreak(userId, courseId, activityDate);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Streak updated successfully',
                    data: {
                        currentStreak: result.data.current_streak,
                        longestStreak: result.data.longest_streak,
                        lastActivityDate: result.data.last_activity_date,
                        isNewRecord: result.data.current_streak === result.data.longest_streak
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to update streak',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('Error in completeLessonStreak:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Get user's streak for a specific course
     * GET /user/streak/course/:courseId
     */
    getCourseStreak = async (req, res) => {
        try {
            const { courseId } = req.params;
            const userId = req.body.user_id;

            const result = await this.streakService.getUserCourseStreak(userId, courseId);

            if (result.success) {
                if (result.data.length > 0) {
                    const streak = result.data[0];
                    res.json({
                        success: true,
                        data: {
                            currentStreak: streak.current_streak,
                            longestStreak: streak.longest_streak,
                            lastActivityDate: streak.last_activity_date,
                            createdAt: streak.created_at
                        }
                    });
                } else {
                    res.json({
                        success: true,
                        data: {
                            currentStreak: 0,
                            longestStreak: 0,
                            lastActivityDate: null,
                            createdAt: null
                        }
                    });
                }
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch streak data'
                });
            }

        } catch (error) {
            console.error('Error in getCourseStreak:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Get all user's streaks (for dashboard)
     * GET /user/streak/dashboard
     */
    getDashboardStreaks = async (req, res) => {
        try {
            const userId = req.body.user_id;

            const result = await this.streakService.getUserStreaks(userId);

            if (result.success) {
                const streaks = result.data.map(streak => ({
                    courseId: streak.course_id,
                    courseTitle: streak.course_title,
                    courseThumbnail: streak.course_thumbnail,
                    currentStreak: streak.current_streak,
                    longestStreak: streak.longest_streak,
                    lastActivityDate: streak.last_activity_date,
                    isActive: this.isStreakActive(streak.last_activity_date)
                }));

                res.json({
                    success: true,
                    data: {
                        streaks,
                        totalCourses: streaks.length,
                        activeStreaks: streaks.filter(s => s.isActive).length,
                        totalCurrentStreak: streaks.reduce((sum, s) => sum + s.currentStreak, 0),
                        longestOverallStreak: Math.max(...streaks.map(s => s.longestStreak), 0)
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch dashboard streaks'
                });
            }

        } catch (error) {
            console.error('Error in getDashboardStreaks:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Get course leaderboard
     * GET /user/streak/leaderboard/:courseId
     */
    getCourseLeaderboard = async (req, res) => {
        try {
            const { courseId } = req.params;
            const { limit = 10 } = req.query;

            const result = await this.streakService.getCourseLeaderboard(courseId, parseInt(limit));

            if (result.success) {
                const leaderboard = result.data.map((entry, index) => ({
                    rank: index + 1,
                    userId: entry.user_id,
                    userName: entry.user_name,
                    currentStreak: entry.current_streak,
                    longestStreak: entry.longest_streak,
                    lastActivityDate: entry.last_activity_date,
                    isActive: this.isStreakActive(entry.last_activity_date)
                }));

                res.json({
                    success: true,
                    data: leaderboard
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch leaderboard'
                });
            }

        } catch (error) {
            console.error('Error in getCourseLeaderboard:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };

    /**
     * Helper method to check if streak is active (activity within last 2 days)
     */
    isStreakActive(lastActivityDate) {
        if (!lastActivityDate) return false;
        
        const today = new Date();
        const lastActivity = new Date(lastActivityDate);
        const diffTime = Math.abs(today - lastActivity);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays <= 1; // Active if last activity was today or yesterday
    }
}

module.exports = StreakController;