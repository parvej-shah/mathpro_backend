const Service = require('./base').Service;
const { v4: uuidv4 } = require('uuid');

class FeedbackService extends Service {
    constructor() {
        super();
    }

    // Submit feedback
    submitFeedback = async (feedbackData) => {
        try {
            const { courseId, userId, rating, comment, category } = feedbackData;

            // Validate rating
            if (rating < 1 || rating > 5) {
                return {
                    success: false,
                    error: 'Invalid rating value'
                };
            }

            // Check if user already submitted feedback for this course
            const existingFeedback = await this.query(
                'SELECT id FROM feedbacks WHERE course_id = $1 AND user_id = $2',
                [courseId, userId]
            );

            if (existingFeedback.success && existingFeedback.data.length > 0) {
                return {
                    success: false,
                    error: 'User already submitted feedback'
                };
            }

            const feedbackId = uuidv4();
            const result = await this.query(
                `INSERT INTO feedbacks (id, course_id, user_id, rating, comment, category) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [feedbackId, courseId, userId, rating, comment || null, category || null]
            );

            if (result.success) {
                return {
                    success: true,
                    feedbackId: result.data[0].id,
                    message: 'Feedback submitted successfully'
                };
            }

            return result;
        } catch (error) {
            console.error('Error submitting feedback:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Check if user has submitted feedback
    checkUserFeedback = async (userId, courseId) => {
        try {
            const result = await this.query(
                `SELECT id, rating, comment, category, created_at 
                 FROM feedbacks 
                 WHERE user_id = $1 AND course_id = $2`,
                [userId, courseId]
            );

            if (result.success) {
                if (result.data.length > 0) {
                    return {
                        success: true,
                        hasSubmitted: true,
                        feedback: {
                            id: result.data[0].id,
                            rating: result.data[0].rating,
                            comment: result.data[0].comment,
                            category: result.data[0].category,
                            createdAt: result.data[0].created_at
                        }
                    };
                } else {
                    return {
                        success: true,
                        hasSubmitted: false,
                        feedback: null
                    };
                }
            }

            return result;
        } catch (error) {
            console.error('Error checking user feedback:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Get course average rating
    getCourseAverage = async (courseId) => {
        try {
            const avgResult = await this.query(
                `SELECT 
                    AVG(rating)::NUMERIC(3,2) as average_rating,
                    COUNT(*) as total_feedbacks
                 FROM feedbacks 
                 WHERE course_id = $1`,
                [courseId]
            );

            const distributionResult = await this.query(
                `SELECT 
                    rating,
                    COUNT(*) as count
                 FROM feedbacks 
                 WHERE course_id = $1
                 GROUP BY rating
                 ORDER BY rating DESC`,
                [courseId]
            );

            if (avgResult.success && distributionResult.success) {
                const avgData = avgResult.data[0];
                const distribution = {};
                
                // Initialize all ratings to 0
                for (let i = 1; i <= 5; i++) {
                    distribution[i] = 0;
                }

                // Fill in actual counts
                distributionResult.data.forEach(row => {
                    distribution[row.rating] = parseInt(row.count);
                });

                return {
                    success: true,
                    courseId,
                    averageRating: parseFloat(avgData.average_rating) || 0,
                    totalFeedbacks: parseInt(avgData.total_feedbacks),
                    ratingDistribution: distribution
                };
            }

            return avgResult;
        } catch (error) {
            console.error('Error getting course average:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Get course feedbacks with pagination
    getCourseFeedbacks = async (courseId, page = 1, limit = 10) => {
        try {
            const offset = (page - 1) * limit;
            
            // Get total count
            const countResult = await this.query(
                'SELECT COUNT(*) as total FROM feedbacks WHERE course_id = $1',
                [courseId]
            );

            // Get feedbacks with user info from managerial_auth table
            const feedbacksResult = await this.query(
                `SELECT 
                    f.id,
                    f.user_id,
                    COALESCE(u.name, 'Anonymous') as user_name,
                    u.email as user_profile,
                    f.rating,
                    f.comment,
                    f.category,
                    f.created_at
                 FROM feedbacks f
                 LEFT JOIN managerial_auth u ON f.user_id = u.id::text
                 WHERE f.course_id = $1
                 ORDER BY f.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [courseId, limit, offset]
            );

            if (countResult.success && feedbacksResult.success) {
                const total = parseInt(countResult.data[0].total);
                const totalPages = Math.ceil(total / limit);

                return {
                    success: true,
                    courseId,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages,
                    feedbacks: feedbacksResult.data.map(feedback => ({
                        id: feedback.id,
                        userId: feedback.user_id,
                        userName: feedback.user_name,
                        userProfile: feedback.user_profile,
                        rating: feedback.rating,
                        comment: feedback.comment,
                        category: feedback.category,
                        createdAt: feedback.created_at
                    }))
                };
            }

            return countResult.success ? feedbacksResult : countResult;
        } catch (error) {
            console.error('Error getting course feedbacks:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Update feedback
    updateFeedback = async (feedbackId, userId, updateData) => {
        try {
            // Check if feedback exists and belongs to user
            const existingResult = await this.query(
                'SELECT user_id FROM feedbacks WHERE id = $1',
                [feedbackId]
            );

            if (!existingResult.success || existingResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Feedback not found'
                };
            }

            if (existingResult.data[0].user_id !== userId) {
                return {
                    success: false,
                    error: 'Unauthorized to update this feedback'
                };
            }

            // Build update query dynamically
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;

            if (updateData.rating !== undefined) {
                if (updateData.rating < 1 || updateData.rating > 5) {
                    return {
                        success: false,
                        error: 'Invalid rating value'
                    };
                }
                updateFields.push(`rating = $${paramIndex++}`);
                updateValues.push(updateData.rating);
            }

            if (updateData.comment !== undefined) {
                updateFields.push(`comment = $${paramIndex++}`);
                updateValues.push(updateData.comment);
            }

            if (updateData.category !== undefined) {
                updateFields.push(`category = $${paramIndex++}`);
                updateValues.push(updateData.category);
            }

            if (updateFields.length === 0) {
                return {
                    success: false,
                    error: 'No fields to update'
                };
            }

            updateValues.push(feedbackId);
            const updateQuery = `UPDATE feedbacks SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;

            const result = await this.query(updateQuery, updateValues);

            if (result.success) {
                return {
                    success: true,
                    message: 'Feedback updated successfully'
                };
            }

            return result;
        } catch (error) {
            console.error('Error updating feedback:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Delete feedback
    deleteFeedback = async (feedbackId, userId) => {
        try {
            // Check if feedback exists and belongs to user
            const existingResult = await this.query(
                'SELECT user_id FROM feedbacks WHERE id = $1',
                [feedbackId]
            );

            if (!existingResult.success || existingResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Feedback not found'
                };
            }

            if (existingResult.data[0].user_id !== userId) {
                return {
                    success: false,
                    error: 'Unauthorized to delete this feedback'
                };
            }

            const result = await this.query(
                'DELETE FROM feedbacks WHERE id = $1',
                [feedbackId]
            );

            if (result.success) {
                return {
                    success: true,
                    message: 'Feedback deleted successfully'
                };
            }

            return result;
        } catch (error) {
            console.error('Error deleting feedback:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Admin: Get all feedbacks with filtering
    getAllFeedbacks = async (filters = {}) => {
        try {
            const { page = 1, limit = 20, courseId, rating, category, sortBy = 'createdAt', order = 'desc', access = null } = filters;
            const offset = (page - 1) * limit;

            // Build WHERE clause
            const whereConditions = [];
            const whereValues = [];
            let paramIndex = 1;

            if (courseId) {
                whereConditions.push(`f.course_id = $${paramIndex++}`);
                whereValues.push(courseId);
            }

            if (rating) {
                whereConditions.push(`f.rating = $${paramIndex++}`);
                whereValues.push(rating);
            }

            if (category) {
                whereConditions.push(`f.category = $${paramIndex++}`);
                whereValues.push(category);
            }

            // Add course access filtering
            if (access && !access.hasGlobalAccess && access.courseIds && access.courseIds.length > 0) {
                whereConditions.push(`f.course_id = ANY($${paramIndex++})`);
                whereValues.push(access.courseIds);
            } else if (access && !access.hasGlobalAccess && (!access.courseIds || access.courseIds.length === 0)) {
                // User has .own permission but no course access - return empty result
                return {
                    success: true,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: 0,
                    totalPages: 0,
                    feedbacks: []
                };
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            // Build ORDER BY clause
            const validSortFields = ['createdAt', 'rating'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
            const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
            const dbSortField = sortField === 'createdAt' ? 'f.created_at' : 'f.rating';

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM feedbacks f 
                ${whereClause}
            `;
            const countResult = await this.query(countQuery, whereValues);

            // Get feedbacks
            const feedbacksQuery = `
                SELECT 
                    f.id,
                    f.course_id,
                    f.course_id as course_name,
                    f.user_id,
                    COALESCE(u.name, 'Anonymous') as user_name,
                    u.email as user_email,
                    f.rating,
                    f.comment,
                    f.category,
                    f.created_at,
                    f.updated_at
                FROM feedbacks f
                LEFT JOIN managerial_auth u ON f.user_id = u.id::text
                ${whereClause}
                ORDER BY ${dbSortField} ${sortOrder}
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            whereValues.push(limit, offset);
            const feedbacksResult = await this.query(feedbacksQuery, whereValues);

            if (countResult.success && feedbacksResult.success) {
                const total = parseInt(countResult.data[0].total);
                const totalPages = Math.ceil(total / limit);

                return {
                    success: true,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages,
                    feedbacks: feedbacksResult.data
                };
            }

            return countResult.success ? feedbacksResult : countResult;
        } catch (error) {
            console.error('Error getting all feedbacks:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Admin: Get feedback statistics
    getFeedbackStats = async (courseId = null, access = null) => {
        try {
            let whereClause = '';
            let params = [];
            
            if (courseId) {
                whereClause = 'WHERE course_id = $1';
                params = [courseId];
            } else if (access && !access.hasGlobalAccess && access.courseIds && access.courseIds.length > 0) {
                whereClause = 'WHERE course_id = ANY($1)';
                params = [access.courseIds];
            } else if (access && !access.hasGlobalAccess && (!access.courseIds || access.courseIds.length === 0)) {
                // User has .own permission but no course access - return empty stats
                return {
                    success: true,
                    data: {
                        total_feedbacks: 0,
                        average_rating: 0,
                        rating_distribution: [],
                        category_distribution: [],
                        top_rated_courses: [],
                        low_rated_courses: []
                    }
                };
            }

            // Get total feedbacks and average rating
            const totalResult = await this.query(
                `SELECT 
                    COUNT(*) as total_feedbacks,
                    AVG(rating)::NUMERIC(3,2) as average_rating
                 FROM feedbacks ${whereClause}`,
                params
            );

            // Get rating distribution
            const ratingDistResult = await this.query(
                `SELECT 
                    rating,
                    COUNT(*) as count
                 FROM feedbacks ${whereClause}
                 GROUP BY rating
                 ORDER BY rating DESC`,
                params
            );

            // Get category distribution
            const categoryDistResult = await this.query(
                `SELECT 
                    category,
                    COUNT(*) as count
                 FROM feedbacks ${whereClause}
                 GROUP BY category
                 ORDER BY count DESC`,
                params
            );

            // Get top rated courses (only if not filtering by specific course)
            let topRatedResult = { success: true, data: [] };
            let lowRatedResult = { success: true, data: [] };

            if (!courseId) {
                const courseWhereClause = (access && !access.hasGlobalAccess && access.courseIds && access.courseIds.length > 0) 
                    ? 'WHERE f.course_id = ANY($1)' 
                    : '';
                const courseParams = (access && !access.hasGlobalAccess && access.courseIds && access.courseIds.length > 0) 
                    ? [access.courseIds] 
                    : [];
                
                topRatedResult = await this.query(
                    `SELECT 
                        f.course_id,
                        f.course_id as course_name,
                        AVG(f.rating)::NUMERIC(3,2) as average_rating,
                        COUNT(*) as total_feedbacks
                     FROM feedbacks f
                     ${courseWhereClause}
                     GROUP BY f.course_id
                     HAVING COUNT(*) >= 5
                     ORDER BY average_rating DESC, total_feedbacks DESC
                     LIMIT 10`,
                    courseParams
                );

                lowRatedResult = await this.query(
                    `SELECT 
                        f.course_id,
                        f.course_id as course_name,
                        AVG(f.rating)::NUMERIC(3,2) as average_rating,
                        COUNT(*) as total_feedbacks
                     FROM feedbacks f
                     ${courseWhereClause}
                     GROUP BY f.course_id
                     HAVING COUNT(*) >= 5
                     ORDER BY average_rating ASC, total_feedbacks DESC
                     LIMIT 10`,
                    courseParams
                );
            }

            if (totalResult.success && ratingDistResult.success && categoryDistResult.success) {
                const totalData = totalResult.data[0];

                // Build rating distribution
                const ratingDistribution = {};
                for (let i = 1; i <= 5; i++) {
                    ratingDistribution[i] = 0;
                }
                ratingDistResult.data.forEach(row => {
                    ratingDistribution[row.rating] = parseInt(row.count);
                });

                // Build category distribution
                const categoryDistribution = {};
                categoryDistResult.data.forEach(row => {
                    if (row.category) {
                        categoryDistribution[row.category] = parseInt(row.count);
                    }
                });

                return {
                    success: true,
                    totalFeedbacks: parseInt(totalData.total_feedbacks),
                    averageRating: parseFloat(totalData.average_rating) || 0,
                    ratingDistribution,
                    categoryDistribution,
                    topRatedCourses: topRatedResult.data || [],
                    lowRatedCourses: lowRatedResult.data || []
                };
            }

            return totalResult;
        } catch (error) {
            console.error('Error getting feedback stats:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Admin: Delete any feedback
    adminDeleteFeedback = async (feedbackId, access = null) => {
        try {
            if (access && !access.hasGlobalAccess && (!access.courseIds || access.courseIds.length === 0)) {
                return {
                    success: false,
                    error: 'NO_COURSE_ACCESS'
                };
            }

            let query = 'DELETE FROM feedbacks WHERE id = $1';
            const params = [feedbackId];
            if (access && !access.hasGlobalAccess) {
                query += ' AND course_id = ANY($2)';
                params.push(access.courseIds);
            }

            const result = await this.query(query, params);

            if (result.success) {
                if (result.rowCount === 0) {
                    return {
                        success: false,
                        error: 'Feedback not found or no course access'
                    };
                }
                return {
                    success: true,
                    message: 'Feedback deleted successfully'
                };
            }

            return result;
        } catch (error) {
            console.error('Error deleting feedback (admin):', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

    // Admin: Export feedbacks
    exportFeedbacks = async (filters = {}) => {
        try {
            const { courseId, startDate, endDate, access = null } = filters;

            const whereConditions = [];
            const whereValues = [];
            let paramIndex = 1;

            if (access && !access.hasGlobalAccess && (!access.courseIds || access.courseIds.length === 0)) {
                return {
                    success: true,
                    data: []
                };
            }

            if (courseId) {
                whereConditions.push(`f.course_id = $${paramIndex++}`);
                whereValues.push(courseId);
            }

            if (access && !access.hasGlobalAccess) {
                whereConditions.push(`f.course_id = ANY($${paramIndex++})`);
                whereValues.push(access.courseIds);
            }

            if (startDate) {
                whereConditions.push(`f.created_at >= $${paramIndex++}`);
                whereValues.push(startDate);
            }

            if (endDate) {
                whereConditions.push(`f.created_at <= $${paramIndex++}`);
                whereValues.push(endDate);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            const result = await this.query(
                `SELECT 
                    f.id,
                    f.course_id,
                    f.course_id as course_name,
                    f.user_id,
                    COALESCE(u.name, 'Anonymous') as user_name,
                    u.email as user_email,
                    f.rating,
                    f.comment,
                    f.category,
                    f.created_at,
                    f.updated_at
                 FROM feedbacks f
                 LEFT JOIN managerial_auth u ON f.user_id = u.id::text
                 ${whereClause}
                 ORDER BY f.created_at DESC`,
                whereValues
            );

            return result;
        } catch (error) {
            console.error('Error exporting feedbacks:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };
}

exports.FeedbackService = FeedbackService;
