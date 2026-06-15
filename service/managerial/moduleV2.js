/**
 * Enhanced Module Service for Phase 8 (v2 APIs)
 * Extends base ModuleService with new Phase 8 features
 */

const ModuleService = require('./module').ModuleService;
const ErrorHandler = require('../../util/errorHandler');
const { validateGoogleDriveLink } = require('../../util/googleDriveValidation');

class ModuleServiceV2 extends ModuleService {
    constructor() {
        super();
    }

    /**
     * Import quiz questions from JSON
     * @param {number} moduleId - Module ID
     * @param {object} quizData - Quiz data object
     * @param {string} mergeMode - 'replace' or 'append'
     * @returns {Promise<object>} Import result
     */
    async importQuiz(moduleId, quizData) {
        try {
            // Verify module exists and is QUIZ type
            const moduleResult = await this.get(moduleId);
            if (!moduleResult.success || moduleResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Module not found',
                    code: 'MODULE_NOT_FOUND'
                };
            }

            const module = moduleResult.data[0];
            // Handle case where data might be a string (JSON) or object
            let moduleData = {};
            if (module.data) {
                if (typeof module.data === 'string') {
                    try {
                        moduleData = JSON.parse(module.data);
                    } catch (e) {
                        moduleData = {};
                    }
                } else if (typeof module.data === 'object') {
                    moduleData = module.data;
                }
            }
            const moduleCategory = moduleData.category;

            if (moduleCategory !== 'QUIZ') {
                return {
                    success: false,
                    error: 'Module is not a quiz',
                    code: 'INVALID_MODULE_CATEGORY',
                    details: {
                        category: 'Module must be of type QUIZ'
                    }
                };
            }

            // Validate quiz data structure
            if (!quizData.quiz || !Array.isArray(quizData.quiz)) {
                return {
                    success: false,
                    error: 'Invalid quiz JSON format',
                    code: 'QUIZ_INVALID_JSON',
                    details: {
                        quiz: 'Quiz data must contain a quiz array'
                    }
                };
            }

            // Validate each question
            const validationErrors = {};
            let totalPoints = 0;

            for (let i = 0; i < quizData.quiz.length; i++) {
                const question = quizData.quiz[i];
                const questionErrors = {};

                // Validate required fields
                if (!question.question) {
                    questionErrors.question = 'Question is required';
                }

                if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
                    questionErrors.options = 'At least 2 options are required';
                }

                // Validate optional HTML fields if provided
                if (question.question_html !== undefined && question.question_html !== null && typeof question.question_html !== 'string') {
                    questionErrors.question_html = 'question_html must be a string if provided';
                }

                if (question.options_html !== undefined && question.options_html !== null) {
                    if (!Array.isArray(question.options_html) || question.options_html.length < 2) {
                        questionErrors.options_html = 'options_html must be an array with at least 2 items if provided';
                    } else if (Array.isArray(question.options) && question.options.length !== question.options_html.length) {
                        questionErrors.options_html = 'options_html array length must match options array length';
                    }
                }

                if (question.points !== undefined && question.points !== null && question.points < 0) {
                    questionErrors.points = 'Points must be non-negative';
                }

                if (Object.keys(questionErrors).length > 0) {
                    validationErrors[`quiz[${i}]`] = questionErrors;
                } else {
                    totalPoints += question.points || 1;
                }
            }

            if (Object.keys(validationErrors).length > 0) {
                return {
                    success: false,
                    error: 'Invalid quiz JSON format',
                    code: 'VALIDATION_ERROR',
                    details: validationErrors
                };
            }

            // Prepare quiz array (questions and options only, no answers/explanations)
            const quizArray = quizData.quiz
                .filter(q => q !== null && q !== undefined) // Filter out null/undefined
                .map(q => {
                    const questionText = q.question || '';
                    const optionsArray = Array.isArray(q.options) ? q.options : [];

                    return {
                        question: questionText,
                        question_html: q.question_html || questionText, // If HTML not provided, use plain text
                        question_latex: q.question_latex || null,
                        options: optionsArray,
                        options_html: Array.isArray(q.options_html) ? q.options_html : optionsArray, // If HTML not provided, use plain text
                        // No answer or explanation fields - admin will add these manually in UI
                        explanation_latex: q.explanation_latex || null, // Keep for backward compatibility
                        points: (q.points !== undefined && q.points !== null) ? q.points : 1
                    };
                });

            // Always replace existing quiz (no append logic)
            moduleData.quiz = quizArray;

            // Update metadata if provided
            if (quizData.metadata) {
                if (quizData.metadata.time_limit !== undefined) {
                    moduleData.quiz_time_limit = quizData.metadata.time_limit;
                }
                if (quizData.metadata.attempt_limit !== undefined) {
                    moduleData.quiz_attempt_limit = quizData.metadata.attempt_limit;
                }
            }

            // Update module
            const updateFields = ['data = $1'];
            const updateParams = [JSON.stringify(moduleData)];
            let paramIndex = 2;

            if (quizData.metadata?.time_limit !== undefined) {
                updateFields.push(`quiz_time_limit = $${paramIndex}`);
                updateParams.push(quizData.metadata.time_limit);
                paramIndex++;
            }

            if (quizData.metadata?.attempt_limit !== undefined) {
                updateFields.push(`quiz_attempt_limit = $${paramIndex}`);
                updateParams.push(quizData.metadata.attempt_limit);
                paramIndex++;
            }

            updateParams.push(moduleId);

            const updateQuery = `
                UPDATE module 
                SET ${updateFields.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING id
            `;
            const updateResult = await this.query(updateQuery, updateParams);

            if (!updateResult.success) {
                return {
                    success: false,
                    error: 'Failed to import quiz',
                    code: 'UPDATE_FAILED'
                };
            }

            return {
                success: true,
                data: {
                    imported_count: quizArray.length,
                    total_questions: moduleData.quiz.length,
                    module_id: moduleId,
                    message: 'Quiz imported successfully'
                }
            };
        } catch (error) {
            console.error('Error importing quiz:', error);
            return {
                success: false,
                error: 'Failed to import quiz',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Export quiz questions as JSON
     * @param {number} moduleId - Module ID
     * @param {string} format - 'full' or 'simple'
     * @param {boolean} includeAnswers - Include answers in export
     * @returns {Promise<object>} Export result
     */
    async exportQuiz(moduleId, format = 'full', includeAnswers = true) {
        try {
            // Verify module exists
            const moduleResult = await this.get(moduleId);
            if (!moduleResult.success || moduleResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Module not found',
                    code: 'MODULE_NOT_FOUND'
                };
            }

            const module = moduleResult.data[0];
            // Handle case where data might be a string (JSON) or object
            let moduleData = {};
            if (module.data) {
                if (typeof module.data === 'string') {
                    try {
                        moduleData = JSON.parse(module.data);
                    } catch (e) {
                        moduleData = {};
                    }
                } else if (typeof module.data === 'object') {
                    moduleData = module.data;
                }
            }

            if (moduleData.category !== 'QUIZ') {
                return {
                    success: false,
                    error: 'Module is not a quiz',
                    code: 'INVALID_MODULE_CATEGORY'
                };
            }

            if (!moduleData.quiz || !Array.isArray(moduleData.quiz)) {
                return {
                    success: true,
                    data: {
                        version: '1.0',
                        quiz: [],
                        metadata: {
                            time_limit: module.quiz_time_limit || null,
                            attempt_limit: module.quiz_attempt_limit || null,
                            total_points: 0
                        }
                    }
                };
            }

            // Format quiz questions
            if (!Array.isArray(moduleData.quiz)) {
                return {
                    success: true,
                    data: {
                        version: '1.0',
                        quiz: [],
                        metadata: {
                            time_limit: module.quiz_time_limit || null,
                            attempt_limit: module.quiz_attempt_limit || null,
                            total_points: 0
                        }
                    }
                };
            }

            const quiz = moduleData.quiz
                .filter(q => q !== null && q !== undefined) // Filter out null/undefined
                .map(q => {
                    const question = {
                        question: q.question || q.question_html || '',
                        question_html: q.question_html || q.question || '',
                        options: Array.isArray(q.options) ? q.options : []
                    };

                    if (q.question_latex) {
                        question.question_latex = q.question_latex;
                    }

                    if (includeAnswers) {
                        question.correct_answer = q.answer || ''; // Already encrypted
                    }

                    if (q.explanation || q.explanation_html) {
                        question.explanation = q.explanation || q.explanation_html || '';
                        question.explanation_html = q.explanation_html || q.explanation || '';
                    }

                    if (q.explanation_latex) {
                        question.explanation_latex = q.explanation_latex;
                    }

                    if (q.points !== undefined) {
                        question.points = q.points;
                    }

                    return question;
                })
                .filter(q => q !== null && q !== undefined); // Remove any nulls

            const totalPoints = quiz.reduce((sum, q) => sum + (q?.points || 1), 0);

            return {
                success: true,
                data: {
                    version: '1.0',
                    quiz: quiz,
                    metadata: {
                        time_limit: module.quiz_time_limit || null,
                        attempt_limit: module.quiz_attempt_limit || null,
                        total_points: totalPoints
                    }
                }
            };
        } catch (error) {
            console.error('Error exporting quiz:', error);
            return {
                success: false,
                error: 'Failed to export quiz',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Update module with enhanced fields
     * @param {number} moduleId - Module ID
     * @param {object} updateData - Update data with new Phase 8 fields
     * @returns {Promise<object>} Update result
     */
    async updateEnhanced(moduleId, updateData) {
        try {
            // Verify module exists
            const moduleResult = await this.get(moduleId);
            if (!moduleResult.success || moduleResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Module not found',
                    code: 'MODULE_NOT_FOUND'
                };
            }

            const module = moduleResult.data[0];
            const updateFields = [];
            const updateParams = [];
            let paramIndex = 1;

            // Handle standard fields
            const standardFields = ['title', 'description', 'score', 'is_live', 'is_free', 'serial'];
            for (const field of standardFields) {
                if (updateData[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex}`);
                    updateParams.push(updateData[field]);
                    paramIndex++;
                }
            }

            if (updateData.quiz_time_limit !== undefined) {
                updateFields.push(`quiz_time_limit = $${paramIndex}`);
                updateParams.push(updateData.quiz_time_limit);
                paramIndex++;
            }

            if (updateData.quiz_attempt_limit !== undefined) {
                updateFields.push(`quiz_attempt_limit = $${paramIndex}`);
                updateParams.push(updateData.quiz_attempt_limit);
                paramIndex++;
            }

            // Live-Class toggle fields (live overlay on a VIDEO module)
            if (updateData.live_status !== undefined) {
                const validStatuses = ['SCHEDULED', 'LIVE', 'ENDED'];
                if (updateData.live_status !== null && !validStatuses.includes(updateData.live_status)) {
                    return {
                        success: false,
                        error: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: {
                            live_status: 'live_status must be one of SCHEDULED, LIVE, ENDED (or null)'
                        }
                    };
                }
                updateFields.push(`live_status = $${paramIndex}`);
                updateParams.push(updateData.live_status);
                paramIndex++;
            }

            if (updateData.live_meeting_id !== undefined) {
                updateFields.push(`live_meeting_id = $${paramIndex}`);
                updateParams.push(updateData.live_meeting_id);
                paramIndex++;
            }

            if (updateData.live_meeting_pass !== undefined) {
                updateFields.push(`live_meeting_pass = $${paramIndex}`);
                updateParams.push(updateData.live_meeting_pass);
                paramIndex++;
            }

            if (updateData.live_scheduled_at !== undefined) {
                updateFields.push(`live_scheduled_at = $${paramIndex}`);
                updateParams.push(updateData.live_scheduled_at);
                paramIndex++;
            }

            // Handle data field (JSON)
            if (updateData.data !== undefined) {
                updateFields.push(`data = $${paramIndex}`);
                // Handle null or object
                if (updateData.data === null) {
                    updateParams.push(null);
                } else if (typeof updateData.data === 'object') {
                    updateParams.push(JSON.stringify(updateData.data));
                } else {
                    // If it's already a string, use it as-is (shouldn't happen but handle it)
                    updateParams.push(updateData.data);
                }
                paramIndex++;
            }

            // Handle PDF drive link in data
            if (updateData.data?.pdf_drive_link !== undefined) {
                // Validate Google Drive link if provided
                if (updateData.data.pdf_drive_link) {
                    const driveValidation = validateGoogleDriveLink(
                        updateData.data.pdf_drive_link
                    );
                    if (!driveValidation.valid) {
                        return {
                            success: false,
                            error: 'Validation failed',
                            code: 'VALIDATION_ERROR',
                            details: {
                                'data.pdf_drive_link': driveValidation.error
                            }
                        };
                    }
                }
                // Update will be handled in data field
            }

            // Update module
            if (updateFields.length > 0) {
                updateParams.push(moduleId);
                const updateQuery = `
                    UPDATE module 
                    SET ${updateFields.join(', ')}
                    WHERE id = $${paramIndex}
                    RETURNING id, title
                `;
                const updateResult = await this.query(updateQuery, updateParams);

                if (!updateResult.success) {
                    return {
                        success: false,
                        error: 'Failed to update module',
                        code: 'UPDATE_FAILED'
                    };
                }

                return {
                    success: true,
                    data: {
                        id: moduleId,
                        title: updateResult.data[0]?.title || module.title,
                        message: 'Module updated successfully'
                    }
                };
            } else {
                return {
                    success: false,
                    error: 'No fields to update',
                    code: 'VALIDATION_ERROR',
                    details: {
                        body: 'At least one field must be provided for update'
                    }
                };
            }
        } catch (error) {
            console.error('Error updating module:', error);
            return {
                success: false,
                error: 'Failed to update module',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Duplicate a module
     * @param {number} moduleId - Original module ID
     * @param {boolean} includeContent - Copy module content
     * @param {number|null} newChapterId - Place in different chapter
     * @returns {Promise<object>} Duplication result
     */
    async duplicateModule(moduleId, includeContent = true, newChapterId = null) {
        try {
            // Get original module
            const moduleResult = await this.get(moduleId);
            if (!moduleResult.success || moduleResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Module not found',
                    code: 'MODULE_NOT_FOUND'
                };
            }

            const originalModule = moduleResult.data[0];
            const targetChapterId = newChapterId || originalModule.chapter_id;

            // Verify target chapter exists
            const chapterQuery = `SELECT id FROM chapter WHERE id = $1`;
            const chapterResult = await this.query(chapterQuery, [targetChapterId]);
            if (!chapterResult.success || chapterResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Chapter not found',
                    code: 'CHAPTER_NOT_FOUND'
                };
            }

            // Get next serial number for the chapter
            const serialQuery = `
                SELECT COALESCE(MAX(serial), 0) + 1 as next_serial 
                FROM module 
                WHERE chapter_id = $1
            `;
            const serialResult = await this.query(serialQuery, [targetChapterId]);
            const nextSerial = serialResult.data[0]?.next_serial || 1;

            // Prepare new module data
            const newModuleData = {
                title: `${originalModule.title || 'Untitled'} (Copy)`,
                description: includeContent ? (originalModule.description || null) : null,
                metadata: includeContent ? (originalModule.metadata || null) : null,
                data: includeContent ? (originalModule.data || { category: 'TEXT' }) : { category: originalModule.data?.category || 'TEXT' },
                is_live: false, // Duplicated modules start as not live
                is_free: originalModule.is_free,
                serial: nextSerial,
                score: originalModule.score,
                chapter_id: targetChapterId,
                quiz_time_limit: originalModule.quiz_time_limit,
                quiz_attempt_limit: originalModule.quiz_attempt_limit,
                pdf_drive_link: originalModule.pdf_drive_link
            };

            // Insert new module
            const insertQuery = `
                INSERT INTO module (
                    title, description, metadata, data, is_live, is_free,
                    serial, score, chapter_id,
                    quiz_time_limit, quiz_attempt_limit, pdf_drive_link
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                ) RETURNING id, title, chapter_id, serial
            `;
            const insertResult = await this.query(insertQuery, [
                newModuleData.title,
                newModuleData.description,
                newModuleData.metadata ? JSON.stringify(newModuleData.metadata) : null,
                newModuleData.data ? JSON.stringify(newModuleData.data) : JSON.stringify({ category: 'TEXT' }),
                newModuleData.is_live,
                newModuleData.is_free,
                newModuleData.serial,
                newModuleData.score,
                newModuleData.chapter_id,
                newModuleData.quiz_time_limit,
                newModuleData.quiz_attempt_limit,
                newModuleData.pdf_drive_link
            ]);

            if (!insertResult.success || !insertResult.data || insertResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Failed to duplicate module',
                    code: 'DUPLICATION_FAILED'
                };
            }

            return {
                success: true,
                data: {
                    original_module_id: moduleId,
                    new_module_id: insertResult.data[0].id,
                    new_module: insertResult.data[0],
                    message: 'Module duplicated successfully'
                }
            };
        } catch (error) {
            console.error('Error duplicating module:', error);
            return {
                success: false,
                error: 'Failed to duplicate module',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Batch update multiple modules
     * @param {array} updates - Array of {module_id, updates} objects
     * @returns {Promise<object>} Batch update result
     */
    async batchUpdate(updates) {
        try {
            if (!Array.isArray(updates) || updates.length === 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: {
                        updates: 'Updates must be a non-empty array'
                    }
                };
            }

            const results = [];
            let updatedCount = 0;
            let failedCount = 0;

            for (const item of updates) {
                if (!item.module_id || !item.updates) {
                    results.push({
                        module_id: item.module_id || null,
                        success: false,
                        error: 'Invalid update item format'
                    });
                    failedCount++;
                    continue;
                }

                const updateResult = await this.updateEnhanced(item.module_id, item.updates);
                results.push({
                    module_id: item.module_id,
                    success: updateResult.success,
                    error: updateResult.error || null
                });

                if (updateResult.success) {
                    updatedCount++;
                } else {
                    failedCount++;
                }
            }

            return {
                success: true,
                data: {
                    updated_count: updatedCount,
                    failed_count: failedCount,
                    results: results
                }
            };
        } catch (error) {
            console.error('Error in batch update:', error);
            return {
                success: false,
                error: 'Failed to perform batch update',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }
}

module.exports = { ModuleServiceV2 };
