const { Service } = require('./base');

class StreakService extends Service {
    constructor() {
        super();
    }

    /**
     * Updates user streak when they complete a lesson
     * Uses UPSERT strategy to handle race conditions
     * @param {string} userId - UUID of the user
     * @param {string} courseId - UUID of the course
     * @param {string} activityDate - Date in YYYY-MM-DD format (user's timezone)
     * @returns {Object} Updated streak data
     */
    async updateStreak(userId, courseId, activityDate) {
        const client = await this.getClient();
        
        try {
            await client.query('BEGIN');

            // UPSERT query that handles all streak logic in the database
            const query = `
                INSERT INTO user_course_streaks (user_id, course_id, current_streak, longest_streak, last_activity_date)
                VALUES ($1, $2, 1, 1, $3)
                ON CONFLICT (user_id, course_id) 
                DO UPDATE SET
                    current_streak = CASE
                        -- Same day: no change (idempotency)
                        WHEN user_course_streaks.last_activity_date = $3 THEN user_course_streaks.current_streak
                        -- Consecutive day: increment streak
                        WHEN user_course_streaks.last_activity_date = ($3::date - INTERVAL '1 day')::date THEN user_course_streaks.current_streak + 1
                        -- Broken streak: reset to 1
                        ELSE 1
                    END,
                    longest_streak = CASE
                        -- Same day: no change
                        WHEN user_course_streaks.last_activity_date = $3 THEN user_course_streaks.longest_streak
                        -- Consecutive day: update if new streak is longer
                        WHEN user_course_streaks.last_activity_date = ($3::date - INTERVAL '1 day')::date THEN 
                            GREATEST(user_course_streaks.longest_streak, user_course_streaks.current_streak + 1)
                        -- Broken streak: keep existing longest, set to 1 if it's the first activity
                        ELSE GREATEST(user_course_streaks.longest_streak, 1)
                    END,
                    last_activity_date = CASE
                        -- Only update date if it's newer (prevents backdating)
                        WHEN $3 >= user_course_streaks.last_activity_date THEN $3
                        ELSE user_course_streaks.last_activity_date
                    END,
                    updated_at = NOW()
                RETURNING *;
            `;

            const result = await client.query(query, [userId, courseId, activityDate]);
            
            await client.query('COMMIT');
            
            return {
                success: true,
                data: result.rows[0]
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error updating streak:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get streak data for a specific user and course
     */
    async getUserCourseStreak(userId, courseId) {
        const query = `
            SELECT * FROM user_course_streaks 
            WHERE user_id = $1 AND course_id = $2
        `;
        
        return await this.query(query, [userId, courseId]);
    }

    /**
     * Get all streaks for a user (for dashboard)
     */
    async getUserStreaks(userId) {
        const query = `
            SELECT 
                ucs.*,
                c.title as course_title,
                c.intro_video as course_thumbnail
            FROM user_course_streaks ucs
            LEFT JOIN course c ON ucs.course_id = c.id
            WHERE ucs.user_id = $1
            ORDER BY ucs.current_streak DESC, ucs.longest_streak DESC
        `;
        
        return await this.query(query, [userId]);
    }

    /**
     * Get streak leaderboard for a course
     */
    async getCourseLeaderboard(courseId, limit = 10) {
        const query = `
            SELECT 
                ucs.user_id,
                ucs.current_streak,
                ucs.longest_streak,
                ucs.last_activity_date,
                u.name as user_name
            FROM user_course_streaks ucs
            LEFT JOIN managerial_auth u ON ucs.user_id = u.id
            WHERE ucs.course_id = $1
            ORDER BY ucs.current_streak DESC, ucs.longest_streak DESC
            LIMIT $2
        `;
        
        return await this.query(query, [courseId, limit]);
    }

    /**
     * Get streak statistics for analytics
     */
    async getStreakAnalytics(courseId = null) {
        let query = `
            SELECT 
                COUNT(*) as total_users,
                AVG(current_streak) as avg_current_streak,
                AVG(longest_streak) as avg_longest_streak,
                MAX(longest_streak) as max_streak,
                COUNT(CASE WHEN current_streak > 0 THEN 1 END) as active_streaks,
                COUNT(CASE WHEN current_streak >= 7 THEN 1 END) as week_plus_streaks,
                COUNT(CASE WHEN current_streak >= 30 THEN 1 END) as month_plus_streaks
            FROM user_course_streaks
        `;
        
        const params = [];
        if (courseId) {
            query += ' WHERE course_id = $1';
            params.push(courseId);
        }
        
        return await this.query(query, params);
    }

    /**
     * Check if user has activity today (for streak validation)
     */
    async hasActivityToday(userId, courseId, today) {
        const query = `
            SELECT EXISTS(
                SELECT 1 FROM user_course_streaks 
                WHERE user_id = $1 AND course_id = $2 AND last_activity_date = $3
            ) as has_activity
        `;
        
        return await this.query(query, [userId, courseId, today]);
    }

    /**
     * Bulk update streaks (for maintenance/corrections)
     */
    async bulkUpdateStreaks(updates) {
        const client = await this.getClient();
        
        try {
            await client.query('BEGIN');
            
            const results = [];
            for (const update of updates) {
                const { userId, courseId, activityDate } = update;
                const result = await this.updateStreak(userId, courseId, activityDate);
                results.push(result);
            }
            
            await client.query('COMMIT');
            return { success: true, results };
            
        } catch (error) {
            await client.query('ROLLBACK');
            return { success: false, error: error.message };
        } finally {
            client.release();
        }
    }
}

module.exports = StreakService;