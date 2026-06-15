const Service = require('./base').Service;

class ModuleFeedbackService extends Service {
    constructor() {
        super();
    }

    /**
     * Submit or update module feedback
     * @param {Object} feedbackData - { moduleId, userId, reaction, reason?, comment? }
     * @returns {Promise<Object>}
     */
    submitFeedback = async (feedbackData) => {
        try {
            const { moduleId, userId, reaction, reason, comment } = feedbackData;

            // Validate reaction
            if (!['like', 'dislike'].includes(reaction)) {
                return {
                    success: false,
                    error: 'Invalid reaction. Must be "like" or "dislike"'
                };
            }

            // Validate reason if provided (check against database)
            if (reason) {
                const reasonValid = await this.query(
                    `SELECT id FROM module_feedback_reasons 
                     WHERE reason_key = $1 AND is_active = true`,
                    [reason]
                );

                if (!reasonValid.success || reasonValid.data.length === 0) {
                    return {
                        success: false,
                        error: 'Invalid or inactive reason'
                    };
                }
            }

            // Validate comment length
            if (comment && comment.length > 500) {
                return {
                    success: false,
                    error: 'Comment must be 500 characters or less'
                };
            }

            // Get module details (course_id, chapter_id)
            const moduleInfo = await this.query(
                `SELECT m.id, m.chapter_id, c.course_id 
                 FROM module m 
                 JOIN chapter c ON m.chapter_id = c.id 
                 WHERE m.id = $1`,
                [moduleId]
            );

            if (!moduleInfo.success || moduleInfo.data.length === 0) {
                return {
                    success: false,
                    error: 'Module not found'
                };
            }

            const { chapter_id, course_id } = moduleInfo.data[0];

            // Upsert feedback (insert or update on conflict)
            const result = await this.query(
                `INSERT INTO module_feedback 
                    (module_id, user_id, course_id, chapter_id, reaction, reason, comment)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (module_id, user_id) 
                 DO UPDATE SET 
                    reaction = EXCLUDED.reaction,
                    reason = EXCLUDED.reason,
                    comment = EXCLUDED.comment,
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [moduleId, userId, course_id, chapter_id, reaction, reason || null, comment || null]
            );

            if (result.success && result.data.length > 0) {
                return {
                    success: true,
                    message: 'Feedback submitted successfully',
                    data: result.data[0]
                };
            }

            return {
                success: false,
                error: 'Failed to submit feedback'
            };
        } catch (error) {
            console.error('Error in submitFeedback:', error);
            return {
                success: false,
                error: 'An error occurred while submitting feedback'
            };
        }
    };

    /**
     * Get user's feedback for a specific module
     * @param {number} moduleId
     * @param {number} userId
     * @returns {Promise<Object>}
     */
    getUserModuleFeedback = async (moduleId, userId) => {
        try {
            const result = await this.query(
                `SELECT * FROM module_feedback 
                 WHERE module_id = $1 AND user_id = $2`,
                [moduleId, userId]
            );

            if (result.success) {
                return {
                    success: true,
                    data: result.data.length > 0 ? result.data[0] : null
                };
            }

            return result;
        } catch (error) {
            console.error('Error in getUserModuleFeedback:', error);
            return {
                success: false,
                error: 'An error occurred while fetching feedback'
            };
        }
    };

    /**
     * Get user's feedback for all modules in a course
     * @param {number} courseId
     * @param {number} userId
     * @returns {Promise<Object>}
     */
    getUserCourseFeedback = async (courseId, userId) => {
        try {
            const result = await this.query(
                `SELECT mf.*, m.title as module_title, c.title as chapter_title
                 FROM module_feedback mf
                 JOIN module m ON mf.module_id = m.id
                 JOIN chapter c ON mf.chapter_id = c.id
                 WHERE mf.course_id = $1 AND mf.user_id = $2
                 ORDER BY c.serial, m.serial`,
                [courseId, userId]
            );

            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    count: result.data.length
                };
            }

            return result;
        } catch (error) {
            console.error('Error in getUserCourseFeedback:', error);
            return {
                success: false,
                error: 'An error occurred while fetching feedback'
            };
        }
    };

    /**
     * Delete user's feedback for a module
     * @param {number} moduleId
     * @param {number} userId
     * @returns {Promise<Object>}
     */
    deleteFeedback = async (moduleId, userId) => {
        try {
            const result = await this.query(
                `DELETE FROM module_feedback 
                 WHERE module_id = $1 AND user_id = $2
                 RETURNING id`,
                [moduleId, userId]
            );

            if (result.success && result.data.length > 0) {
                return {
                    success: true,
                    message: 'Feedback deleted successfully'
                };
            }

            return {
                success: false,
                error: 'Feedback not found'
            };
        } catch (error) {
            console.error('Error in deleteFeedback:', error);
            return {
                success: false,
                error: 'An error occurred while deleting feedback'
            };
        }
    };

    /**
     * Get module feedback stats (likes, dislikes, reason breakdown)
     * @param {number} moduleId
     * @returns {Promise<Object>}
     */
    getModuleStats = async (moduleId) => {
        try {
            // Get like/dislike counts
            const countsResult = await this.query(
                `SELECT 
                    COUNT(*) FILTER (WHERE reaction = 'like') as likes,
                    COUNT(*) FILTER (WHERE reaction = 'dislike') as dislikes,
                    COUNT(*) as total
                 FROM module_feedback 
                 WHERE module_id = $1`,
                [moduleId]
            );

            // Get reason breakdown for dislikes
            const reasonsResult = await this.query(
                `SELECT reason, COUNT(*) as count
                 FROM module_feedback 
                 WHERE module_id = $1 AND reaction = 'dislike' AND reason IS NOT NULL
                 GROUP BY reason
                 ORDER BY count DESC`,
                [moduleId]
            );

            // Get recent comments
            const commentsResult = await this.query(
                `SELECT mf.reaction, mf.reason, mf.comment, mf.created_at,
                        ma.name as user_name
                 FROM module_feedback mf
                 JOIN managerial_auth ma ON mf.user_id = ma.id
                 WHERE mf.module_id = $1 AND mf.comment IS NOT NULL
                 ORDER BY mf.created_at DESC
                 LIMIT 10`,
                [moduleId]
            );

            const counts = countsResult.success ? countsResult.data[0] : { likes: 0, dislikes: 0, total: 0 };
            const likePercentage = counts.total > 0 
                ? Math.round((parseInt(counts.likes) / parseInt(counts.total)) * 100) 
                : 0;

            return {
                success: true,
                data: {
                    module_id: moduleId,
                    likes: parseInt(counts.likes) || 0,
                    dislikes: parseInt(counts.dislikes) || 0,
                    total: parseInt(counts.total) || 0,
                    like_percentage: likePercentage,
                    dislike_reasons: reasonsResult.success ? reasonsResult.data : [],
                    recent_comments: commentsResult.success ? commentsResult.data : []
                }
            };
        } catch (error) {
            console.error('Error in getModuleStats:', error);
            return {
                success: false,
                error: 'An error occurred while fetching module stats'
            };
        }
    };

    /**
     * Get course-wide feedback report
     * @param {number} courseId
     * @returns {Promise<Object>}
     */
    getCourseReport = async (courseId) => {
        try {
            // Get overall course stats
            const overallResult = await this.query(
                `SELECT 
                    COUNT(*) FILTER (WHERE reaction = 'like') as total_likes,
                    COUNT(*) FILTER (WHERE reaction = 'dislike') as total_dislikes,
                    COUNT(*) as total_feedback,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT module_id) as modules_with_feedback
                 FROM module_feedback 
                 WHERE course_id = $1`,
                [courseId]
            );

            // Get per-module stats
            const modulesResult = await this.query(
                `SELECT 
                    m.id as module_id,
                    m.title as module_title,
                    c.title as chapter_title,
                    c.serial as chapter_serial,
                    m.serial as module_serial,
                    COUNT(*) FILTER (WHERE mf.reaction = 'like') as likes,
                    COUNT(*) FILTER (WHERE mf.reaction = 'dislike') as dislikes,
                    COUNT(*) as total
                 FROM module m
                 JOIN chapter c ON m.chapter_id = c.id
                 LEFT JOIN module_feedback mf ON m.id = mf.module_id
                 WHERE c.course_id = $1
                 GROUP BY m.id, m.title, c.title, c.serial, m.serial
                 ORDER BY c.serial, m.serial`,
                [courseId]
            );

            // Get top dislike reasons across course
            const reasonsResult = await this.query(
                `SELECT reason, COUNT(*) as count
                 FROM module_feedback 
                 WHERE course_id = $1 AND reaction = 'dislike' AND reason IS NOT NULL
                 GROUP BY reason
                 ORDER BY count DESC`,
                [courseId]
            );

            // Get modules with most dislikes (problem areas)
            const problemModulesResult = await this.query(
                `SELECT 
                    m.id as module_id,
                    m.title as module_title,
                    c.title as chapter_title,
                    COUNT(*) as dislike_count
                 FROM module_feedback mf
                 JOIN module m ON mf.module_id = m.id
                 JOIN chapter c ON m.chapter_id = c.id
                 WHERE mf.course_id = $1 AND mf.reaction = 'dislike'
                 GROUP BY m.id, m.title, c.title
                 HAVING COUNT(*) >= 3
                 ORDER BY dislike_count DESC
                 LIMIT 10`,
                [courseId]
            );

            const overall = overallResult.success ? overallResult.data[0] : {};
            const likePercentage = overall.total_feedback > 0 
                ? Math.round((parseInt(overall.total_likes) / parseInt(overall.total_feedback)) * 100) 
                : 0;

            return {
                success: true,
                data: {
                    course_id: courseId,
                    summary: {
                        total_likes: parseInt(overall.total_likes) || 0,
                        total_dislikes: parseInt(overall.total_dislikes) || 0,
                        total_feedback: parseInt(overall.total_feedback) || 0,
                        unique_users: parseInt(overall.unique_users) || 0,
                        modules_with_feedback: parseInt(overall.modules_with_feedback) || 0,
                        like_percentage: likePercentage
                    },
                    top_dislike_reasons: reasonsResult.success ? reasonsResult.data : [],
                    problem_modules: problemModulesResult.success ? problemModulesResult.data : [],
                    modules: modulesResult.success ? modulesResult.data.map(m => ({
                        ...m,
                        likes: parseInt(m.likes) || 0,
                        dislikes: parseInt(m.dislikes) || 0,
                        total: parseInt(m.total) || 0,
                        like_percentage: m.total > 0 ? Math.round((m.likes / m.total) * 100) : null
                    })) : []
                }
            };
        } catch (error) {
            console.error('Error in getCourseReport:', error);
            return {
                success: false,
                error: 'An error occurred while fetching course report'
            };
        }
    };

    /**
     * Get all feedback with filters (admin)
     * @param {Object} filters - { courseId?, moduleId?, reaction?, reason?, page, limit }
     * @returns {Promise<Object>}
     */
    getAllFeedback = async (filters = {}) => {
        try {
            const { courseId, moduleId, reaction, reason, page = 1, limit = 20, access = null } = filters;
            const offset = (page - 1) * limit;

            let whereConditions = [];
            let params = [];
            let paramIndex = 1;

            if (access && !access.hasGlobalAccess && (!access.courseIds || access.courseIds.length === 0)) {
                return {
                    success: true,
                    data: [],
                    pagination: {
                        total: 0,
                        page,
                        limit,
                        totalPages: 0
                    }
                };
            }

            if (courseId) {
                whereConditions.push(`mf.course_id = $${paramIndex++}`);
                params.push(courseId);
            }
            if (moduleId) {
                whereConditions.push(`mf.module_id = $${paramIndex++}`);
                params.push(moduleId);
            }
            if (reaction) {
                whereConditions.push(`mf.reaction = $${paramIndex++}`);
                params.push(reaction);
            }
            if (reason) {
                whereConditions.push(`mf.reason = $${paramIndex++}`);
                params.push(reason);
            }

            if (access && !access.hasGlobalAccess) {
                whereConditions.push(`mf.course_id = ANY($${paramIndex++})`);
                params.push(access.courseIds);
            }

            const whereClause = whereConditions.length > 0 
                ? 'WHERE ' + whereConditions.join(' AND ') 
                : '';

            // Get feedback list
            const result = await this.query(
                `SELECT mf.*, 
                        m.title as module_title,
                        ch.title as chapter_title,
                        co.title as course_title,
                        ma.name as user_name,
                        ma.login as user_login
                 FROM module_feedback mf
                 JOIN module m ON mf.module_id = m.id
                 JOIN chapter ch ON mf.chapter_id = ch.id
                 JOIN course co ON mf.course_id = co.id
                 JOIN managerial_auth ma ON mf.user_id = ma.id
                 ${whereClause}
                 ORDER BY mf.created_at DESC
                 LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
                [...params, limit, offset]
            );

            // Get total count
            const countResult = await this.query(
                `SELECT COUNT(*) as total FROM module_feedback mf ${whereClause}`,
                params
            );

            const total = countResult.success ? parseInt(countResult.data[0].total) : 0;

            return {
                success: true,
                data: result.success ? result.data : [],
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error in getAllFeedback:', error);
            return {
                success: false,
                error: 'An error occurred while fetching feedback'
            };
        }
    };

    /**
     * Get module stats with user's reaction (for displaying in UI)
     * @param {number} moduleId
     * @param {number} userId
     * @returns {Promise<Object>}
     */
    getModuleStatsWithUserReaction = async (moduleId, userId) => {
        try {
            // Get counts
            const countsResult = await this.query(
                `SELECT 
                    COUNT(*) FILTER (WHERE reaction = 'like') as likes,
                    COUNT(*) FILTER (WHERE reaction = 'dislike') as dislikes
                 FROM module_feedback 
                 WHERE module_id = $1`,
                [moduleId]
            );

            // Get user's reaction
            const userReactionResult = await this.query(
                `SELECT reaction FROM module_feedback 
                 WHERE module_id = $1 AND user_id = $2`,
                [moduleId, userId]
            );

            const counts = countsResult.success ? countsResult.data[0] : { likes: 0, dislikes: 0 };

            return {
                success: true,
                data: {
                    likes: parseInt(counts.likes) || 0,
                    dislikes: parseInt(counts.dislikes) || 0,
                    user_reaction: userReactionResult.success && userReactionResult.data.length > 0 
                        ? userReactionResult.data[0].reaction 
                        : null
                }
            };
        } catch (error) {
            console.error('Error in getModuleStatsWithUserReaction:', error);
            return {
                success: false,
                error: 'An error occurred while fetching module stats'
            };
        }
    };

    // ==================== FEEDBACK REASONS CRUD ====================

    /**
     * Get all feedback reasons (with optional filter for active only)
     * @param {boolean} activeOnly - Whether to return only active reasons
     * @returns {Promise<Object>}
     */
    getAllReasons = async (activeOnly = false) => {
        try {
            const whereClause = activeOnly ? 'WHERE is_active = true' : '';
            
            const result = await this.query(
                `SELECT * FROM module_feedback_reasons 
                 ${whereClause}
                 ORDER BY display_order ASC, id ASC`
            );

            return {
                success: true,
                data: result.success ? result.data : []
            };
        } catch (error) {
            console.error('Error in getAllReasons:', error);
            return {
                success: false,
                error: 'An error occurred while fetching reasons'
            };
        }
    };

    /**
     * Get a single reason by ID
     * @param {number} reasonId
     * @returns {Promise<Object>}
     */
    getReasonById = async (reasonId) => {
        try {
            const result = await this.query(
                `SELECT * FROM module_feedback_reasons WHERE id = $1`,
                [reasonId]
            );

            if (result.success && result.data.length > 0) {
                return {
                    success: true,
                    data: result.data[0]
                };
            }

            return {
                success: false,
                error: 'Reason not found'
            };
        } catch (error) {
            console.error('Error in getReasonById:', error);
            return {
                success: false,
                error: 'An error occurred while fetching reason'
            };
        }
    };

    /**
     * Create a new feedback reason
     * @param {Object} reasonData - { reason_key, reason_label, description?, display_order?, is_active? }
     * @returns {Promise<Object>}
     */
    createReason = async (reasonData) => {
        try {
            const { reason_key, reason_label, description, display_order = 0, is_active = true } = reasonData;

            // Validate required fields
            if (!reason_key || !reason_label) {
                return {
                    success: false,
                    error: 'reason_key and reason_label are required'
                };
            }

            // Validate reason_key format (alphanumeric and underscore only)
            if (!/^[a-z0-9_]+$/.test(reason_key)) {
                return {
                    success: false,
                    error: 'reason_key must contain only lowercase letters, numbers, and underscores'
                };
            }

            // Check if reason_key already exists
            const existingReason = await this.query(
                `SELECT id FROM module_feedback_reasons WHERE reason_key = $1`,
                [reason_key]
            );

            if (existingReason.success && existingReason.data.length > 0) {
                return {
                    success: false,
                    error: 'A reason with this key already exists'
                };
            }

            const result = await this.query(
                `INSERT INTO module_feedback_reasons 
                    (reason_key, reason_label, description, display_order, is_active)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [reason_key, reason_label, description || null, display_order, is_active]
            );

            if (result.success && result.data.length > 0) {
                return {
                    success: true,
                    message: 'Reason created successfully',
                    data: result.data[0]
                };
            }

            return {
                success: false,
                error: 'Failed to create reason'
            };
        } catch (error) {
            console.error('Error in createReason:', error);
            return {
                success: false,
                error: 'An error occurred while creating reason'
            };
        }
    };

    /**
     * Update an existing feedback reason
     * @param {number} reasonId
     * @param {Object} updateData - { reason_label?, description?, display_order?, is_active? }
     * @returns {Promise<Object>}
     */
    updateReason = async (reasonId, updateData) => {
        try {
            const { reason_label, description, display_order, is_active } = updateData;

            // Build update fields dynamically
            const updates = [];
            const params = [];
            let paramIndex = 1;

            if (reason_label !== undefined) {
                updates.push(`reason_label = $${paramIndex++}`);
                params.push(reason_label);
            }
            if (description !== undefined) {
                updates.push(`description = $${paramIndex++}`);
                params.push(description);
            }
            if (display_order !== undefined) {
                updates.push(`display_order = $${paramIndex++}`);
                params.push(display_order);
            }
            if (is_active !== undefined) {
                updates.push(`is_active = $${paramIndex++}`);
                params.push(is_active);
            }

            if (updates.length === 0) {
                return {
                    success: false,
                    error: 'No fields to update'
                };
            }

            params.push(reasonId);

            const result = await this.query(
                `UPDATE module_feedback_reasons 
                 SET ${updates.join(', ')}
                 WHERE id = $${paramIndex}
                 RETURNING *`,
                params
            );

            if (result.success && result.data.length > 0) {
                return {
                    success: true,
                    message: 'Reason updated successfully',
                    data: result.data[0]
                };
            }

            return {
                success: false,
                error: 'Reason not found'
            };
        } catch (error) {
            console.error('Error in updateReason:', error);
            return {
                success: false,
                error: 'An error occurred while updating reason'
            };
        }
    };

    /**
     * Delete a feedback reason
     * @param {number} reasonId
     * @returns {Promise<Object>}
     */
    deleteReason = async (reasonId) => {
        try {
            // Check if reason is being used in any feedback
            const usageCheck = await this.query(
                `SELECT mfr.reason_key, COUNT(mf.id) as usage_count
                 FROM module_feedback_reasons mfr
                 LEFT JOIN module_feedback mf ON mf.reason = mfr.reason_key
                 WHERE mfr.id = $1
                 GROUP BY mfr.reason_key`,
                [reasonId]
            );

            if (usageCheck.success && usageCheck.data.length > 0 && parseInt(usageCheck.data[0].usage_count) > 0) {
                return {
                    success: false,
                    error: `Cannot delete reason as it is being used in ${usageCheck.data[0].usage_count} feedback entries. Consider deactivating it instead.`
                };
            }

            const result = await this.query(
                `DELETE FROM module_feedback_reasons 
                 WHERE id = $1
                 RETURNING *`,
                [reasonId]
            );

            if (result.success && result.data.length > 0) {
                return {
                    success: true,
                    message: 'Reason deleted successfully'
                };
            }

            return {
                success: false,
                error: 'Reason not found'
            };
        } catch (error) {
            console.error('Error in deleteReason:', error);
            return {
                success: false,
                error: 'An error occurred while deleting reason'
            };
        }
    };

    /**
     * Bulk update reason display orders
     * @param {Array} orderData - Array of { id, display_order }
     * @returns {Promise<Object>}
     */
    updateReasonOrders = async (orderData) => {
        try {
            if (!Array.isArray(orderData) || orderData.length === 0) {
                return {
                    success: false,
                    error: 'orderData must be a non-empty array'
                };
            }

            // Use transaction for bulk update
            const client = await this.getClient();
            await client.query('BEGIN');

            try {
                for (const item of orderData) {
                    await client.query(
                        'UPDATE module_feedback_reasons SET display_order = $1 WHERE id = $2',
                        [item.display_order, item.id]
                    );
                }

                await client.query('COMMIT');
                client.release();

                return {
                    success: true,
                    message: 'Reason orders updated successfully'
                };
            } catch (err) {
                await client.query('ROLLBACK');
                client.release();
                throw err;
            }
        } catch (error) {
            console.error('Error in updateReasonOrders:', error);
            return {
                success: false,
                error: 'An error occurred while updating reason orders'
            };
        }
    };
}

module.exports = {
    ModuleFeedbackService
};
