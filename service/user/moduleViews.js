const Service = require("../base").Service;

class ModuleViewsService extends Service {
    constructor() {
        super();
    }

    /**
     * Check if user is enrolled in the course
     * @param {number} userId - User ID
     * @param {number} courseId - Course ID
     * @returns {Promise<{success: boolean, enrolled: boolean}>}
     */
    checkEnrollment = async (userId, courseId) => {
        try {
            // Validate inputs
            if (!userId || !courseId || isNaN(userId) || isNaN(courseId)) {
                return {
                    success: false,
                    enrolled: false,
                    error: "Invalid user ID or course ID"
                };
            }

            const query = `SELECT user_id FROM takes WHERE user_id = $1 AND course_id = $2`;
            const result = await this.query(query, [userId, courseId]);
            
            return {
                success: result.success,
                enrolled: result.success && result.data && result.data.length > 0
            };
        } catch (error) {
            console.error('Error checking enrollment:', error);
            return {
                success: false,
                enrolled: false,
                error: error.message
            };
        }
    };

    /**
     * Record when a user views a module
     * @param {number} userId - User ID
     * @param {number} courseId - Course ID
     * @param {number} moduleId - Module ID
     * @param {number} chapterId - Chapter ID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    recordView = async (userId, courseId, moduleId, chapterId) => {
        try {
            // Validate inputs
            if (!userId || !courseId || !moduleId || !chapterId) {
                return {
                    success: false,
                    error: "userId, courseId, moduleId, and chapterId are required"
                };
            }

            if (isNaN(userId) || isNaN(courseId) || isNaN(moduleId) || isNaN(chapterId)) {
                return {
                    success: false,
                    error: "All IDs must be valid numbers"
                };
            }

            // Check enrollment
            const enrollmentCheck = await this.checkEnrollment(userId, courseId);
            if (!enrollmentCheck.success || !enrollmentCheck.enrolled) {
                return {
                    success: false,
                    error: "You are not enrolled in this course"
                };
            }

            // Verify course exists
            const courseCheckQuery = `SELECT id FROM course WHERE id = $1`;
            const courseCheck = await this.query(courseCheckQuery, [courseId]);
            if (!courseCheck.success || !courseCheck.data || courseCheck.data.length === 0) {
                return {
                    success: false,
                    error: "Course not found"
                };
            }

            // Verify module belongs to the course and chapter
            const moduleCheckQuery = `
                SELECT m.id, m.chapter_id, c.course_id 
                FROM module m
                JOIN chapter c ON m.chapter_id = c.id
                WHERE m.id = $1 AND c.course_id = $2 AND m.chapter_id = $3
            `;
            const moduleCheck = await this.query(moduleCheckQuery, [moduleId, courseId, chapterId]);
            
            if (!moduleCheck.success || !moduleCheck.data || moduleCheck.data.length === 0) {
                return {
                    success: false,
                    error: "Module not found or does not belong to this course"
                };
            }

            const client = await this.getClient();
            try {
                await client.query('BEGIN');

                const timestamp = Math.floor(Date.now() / 1000);

                // Check if record exists
                const existingQuery = `
                    SELECT id, view_count, last_viewed_at 
                    FROM user_module_views 
                    WHERE user_id = $1 AND course_id = $2 AND module_id = $3
                `;
                const existingResult = await client.query(existingQuery, [userId, courseId, moduleId]);

                if (existingResult.rows && existingResult.rows.length > 0) {
                    // Update existing record - update chapter_id in case it changed
                    const updateQuery = `
                        UPDATE user_module_views 
                        SET view_count = view_count + 1,
                            last_viewed_at = $1,
                            chapter_id = $2
                        WHERE user_id = $3 AND course_id = $4 AND module_id = $5
                        RETURNING *
                    `;
                    await client.query(updateQuery, [timestamp, chapterId, userId, courseId, moduleId]);
                    
                    await client.query('COMMIT');
                    
                    return {
                        success: true,
                        data: {
                            courseId: courseId,
                            moduleId: moduleId,
                            chapterId: chapterId,
                            timestamp: timestamp
                        }
                    };
                } else {
                    // Insert new record
                    const insertQuery = `
                        INSERT INTO user_module_views 
                        (user_id, course_id, module_id, chapter_id, viewed_at, view_count, last_viewed_at)
                        VALUES ($1, $2, $3, $4, $5, 1, $5)
                        RETURNING *
                    `;
                    await client.query(insertQuery, [userId, courseId, moduleId, chapterId, timestamp]);
                    
                    // Note: We keep ALL module views in the database
                    // The APIs will return only the last 5 using LIMIT in queries
                    // This allows us to track complete view history for analytics
                    
                    await client.query('COMMIT');
                    
                    return {
                        success: true,
                        data: {
                            courseId: courseId,
                            moduleId: moduleId,
                            chapterId: chapterId,
                            timestamp: timestamp
                        }
                    };
                }
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error recording module view:', error);
            return {
                success: false,
                error: error.message || 'Failed to record module view'
            };
        }
    };

    /**
     * Get last 5 recently viewed modules for a course
     * @param {number} userId - User ID
     * @param {number} courseId - Course ID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    getRecentViews = async (userId, courseId) => {
        try {
            // Validate inputs
            if (!userId || !courseId || isNaN(userId) || isNaN(courseId)) {
                return {
                    success: false,
                    error: "Valid userId and courseId are required"
                };
            }

            // Check enrollment
            const enrollmentCheck = await this.checkEnrollment(userId, courseId);
            if (!enrollmentCheck.success || !enrollmentCheck.enrolled) {
                return {
                    success: false,
                    error: "You are not enrolled in this course"
                };
            }

            // Use LEFT JOIN to handle deleted modules/chapters gracefully
            const query = `
                SELECT 
                    umv.module_id as "moduleId",
                    umv.chapter_id as "chapterId",
                    COALESCE(m.title, 'Deleted Module') as "moduleTitle",
                    COALESCE(c.title, 'Deleted Chapter') as "chapterTitle",
                    umv.last_viewed_at as "timestamp",
                    umv.view_count as "viewCount"
                FROM user_module_views umv
                LEFT JOIN module m ON umv.module_id = m.id
                LEFT JOIN chapter c ON umv.chapter_id = c.id
                WHERE umv.user_id = $1 AND umv.course_id = $2
                ORDER BY umv.last_viewed_at DESC
                LIMIT 5
            `;
            
            const result = await this.query(query, [userId, courseId]);
            
            if (!result.success) {
                return {
                    success: false,
                    error: result.error?.message || (typeof result.error === 'string' ? result.error : 'Failed to get recent views')
                };
            }

            // Get total views count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM user_module_views
                WHERE user_id = $1 AND course_id = $2
            `;
            const countResult = await this.query(countQuery, [userId, courseId]);
            const totalViews = countResult.success && countResult.data && countResult.data.length > 0 
                ? parseInt(countResult.data[0].total) || 0
                : 0;
            
            // Handle case where result.data might be null
            const recentViews = (result.data && Array.isArray(result.data)) ? result.data : [];

            return {
                success: true,
                data: {
                    courseId: courseId,
                    recentViews: recentViews,
                    totalViews: totalViews
                }
            };
        } catch (error) {
            console.error('Error getting recent views:', error);
            return {
                success: false,
                error: error.message || 'Failed to get recent views'
            };
        }
    };

    /**
     * Get most recent module for a course and next module if exists
     * @param {number} userId - User ID
     * @param {number} courseId - Course ID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    getMostRecent = async (userId, courseId) => {
        try {
            // Validate inputs
            if (!userId || !courseId || isNaN(userId) || isNaN(courseId)) {
                return {
                    success: false,
                    error: "Valid userId and courseId are required"
                };
            }

            // Check enrollment
            const enrollmentCheck = await this.checkEnrollment(userId, courseId);
            if (!enrollmentCheck.success || !enrollmentCheck.enrolled) {
                return {
                    success: false,
                    error: "You are not enrolled in this course"
                };
            }

            // Get most recent view - order by last_viewed_at DESC, then by id DESC as tiebreaker
            const recentQuery = `
                SELECT 
                    umv.module_id as "moduleId",
                    umv.chapter_id as "chapterId",
                    umv.last_viewed_at as "timestamp"
                FROM user_module_views umv
                WHERE umv.user_id = $1 AND umv.course_id = $2
                ORDER BY umv.last_viewed_at DESC, umv.id DESC
                LIMIT 1
            `;
            
            const recentResult = await this.query(recentQuery, [userId, courseId]);
            
            const now = Math.floor(Date.now() / 1000);
            const sevenDaysAgo = now - (7 * 24 * 60 * 60);

            const getFirstModuleInCourse = async () => {
                const firstModuleQuery = `
                    SELECT 
                        m.id as "moduleId",
                        m.chapter_id as "chapterId",
                        m.title as "moduleTitle",
                        c.title as "chapterTitle"
                    FROM module m
                    JOIN chapter c ON m.chapter_id = c.id
                    WHERE c.course_id = $1
                    ORDER BY c.serial ASC, m.serial ASC
                    LIMIT 1
                `;

                const firstModuleResult = await this.query(firstModuleQuery, [courseId]);
                if (firstModuleResult.success && firstModuleResult.data && firstModuleResult.data.length > 0) {
                    return {
                        moduleId: firstModuleResult.data[0].moduleId,
                        chapterId: firstModuleResult.data[0].chapterId,
                        moduleTitle: firstModuleResult.data[0].moduleTitle,
                        chapterTitle: firstModuleResult.data[0].chapterTitle
                    };
                }

                return null;
            };
            
            let mostRecent = null;
            let nextModule = null;

            if (recentResult.success && recentResult.data && recentResult.data.length > 0) {
                const recent = recentResult.data[0];
                
                // Validate timestamp
                if (!recent.timestamp || isNaN(recent.timestamp)) {
                    // Invalid timestamp, skip
                    nextModule = await getFirstModuleInCourse();
                    return {
                        success: true,
                        data: {
                            courseId: courseId,
                            mostRecent: null,
                            nextModule: nextModule
                        }
                    };
                }

                const isRecent = recent.timestamp >= sevenDaysAgo;
                
                if (isRecent) {
                    mostRecent = {
                        moduleId: recent.moduleId,
                        chapterId: recent.chapterId,
                        timestamp: recent.timestamp,
                        isRecent: true
                    };

                    // Get next module in course sequence
                    // First verify the module still exists and get its serial
                    const currentModuleQuery = `
                        SELECT m.serial as module_serial, c.serial as chapter_serial
                        FROM module m
                        JOIN chapter c ON m.chapter_id = c.id
                        WHERE m.id = $1 AND c.id = $2 AND c.course_id = $3
                    `;
                    const currentModuleResult = await this.query(currentModuleQuery, [recent.moduleId, recent.chapterId, courseId]);
                    
                    if (currentModuleResult.success && currentModuleResult.data && currentModuleResult.data.length > 0) {
                        const currentChapterSerial = currentModuleResult.data[0].chapter_serial;
                        const currentModuleSerial = currentModuleResult.data[0].module_serial;
                        
                        // Validate serials are not null
                        if (currentChapterSerial !== null && currentModuleSerial !== null) {
                            // Find next module: 
                            // 1. First try to find next module in same chapter (m.serial > currentModuleSerial)
                            // 2. If not found, get first module of next chapter (c.serial > currentChapterSerial)
                            // ORDER BY ensures we get the correct next module (prioritizes same chapter, then next chapter's first module)
                            const nextModuleQuery = `
                                SELECT 
                                    m.id as "moduleId",
                                    m.chapter_id as "chapterId",
                                    m.title as "moduleTitle",
                                    c.title as "chapterTitle"
                                FROM module m
                                JOIN chapter c ON m.chapter_id = c.id
                                WHERE c.course_id = $1
                                AND (
                                    -- Next module in same chapter
                                    (c.serial = $2 AND m.serial > $3)
                                    OR
                                    -- First module of next chapter (when current module is last in chapter)
                                    (c.serial > $2)
                                )
                                ORDER BY 
                                    -- Prioritize same chapter first (0 comes before 1)
                                    CASE WHEN c.serial = $2 THEN 0 ELSE 1 END,
                                    c.serial ASC, 
                                    m.serial ASC
                                LIMIT 1
                            `;
                            
                            const nextResult = await this.query(nextModuleQuery, [courseId, currentChapterSerial, currentModuleSerial]);
                            
                            if (nextResult.success && nextResult.data && nextResult.data.length > 0) {
                                nextModule = {
                                    moduleId: nextResult.data[0].moduleId,
                                    chapterId: nextResult.data[0].chapterId,
                                    moduleTitle: nextResult.data[0].moduleTitle,
                                    chapterTitle: nextResult.data[0].chapterTitle
                                };
                            }
                        }
                    }
                    // If module was deleted or doesn't exist, mostRecent is still set but nextModule remains null
                }
            } else {
                // New enrolled user with no history: suggest first module of course
                nextModule = await getFirstModuleInCourse();
            }

            return {
                success: true,
                data: {
                    courseId: courseId,
                    mostRecent: mostRecent,
                    nextModule: nextModule
                }
            };
        } catch (error) {
            console.error('Error getting most recent module:', error);
            return {
                success: false,
                error: error.message || 'Failed to get most recent module'
            };
        }
    };

    /**
     * Clear all recent views for a course
     * @param {number} userId - User ID
     * @param {number} courseId - Course ID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    clearRecentViews = async (userId, courseId) => {
        try {
            // Validate inputs
            if (!userId || !courseId || isNaN(userId) || isNaN(courseId)) {
                return {
                    success: false,
                    error: "Valid userId and courseId are required"
                };
            }

            // Check enrollment
            const enrollmentCheck = await this.checkEnrollment(userId, courseId);
            if (!enrollmentCheck.success || !enrollmentCheck.enrolled) {
                return {
                    success: false,
                    error: "You are not enrolled in this course"
                };
            }

            const query = `
                DELETE FROM user_module_views
                WHERE user_id = $1 AND course_id = $2
            `;
            
            const result = await this.query(query, [userId, courseId]);
            
            if (!result.success) {
                return result;
            }

            return {
                success: true,
                data: {
                    courseId: courseId,
                    deletedCount: result.rowCount || 0
                }
            };
        } catch (error) {
            console.error('Error clearing recent views:', error);
            return {
                success: false,
                error: error.message || 'Failed to clear recent views'
            };
        }
    };
}

module.exports = { ModuleViewsService };

