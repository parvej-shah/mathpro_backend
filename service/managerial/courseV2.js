/**
 * Enhanced Course Service for Phase 8 (v2 APIs)
 * Handles course import/export, module reordering, and enhanced features
 */

const Service = require('../base').Service;
const ModuleService = require('./module').ModuleService;
const ChapterService = require('./chapter').ChapterService;
const ErrorHandler = require('../../util/errorHandler');
const { v4: uuidv4 } = require('uuid');

class CourseServiceV2 extends Service {
    constructor() {
        super();
        this.moduleService = new ModuleService();
        this.chapterService = new ChapterService();
    }

    table = 'course';
    pk = 'id';
    cols = [
        'title',
        'x_price',
        'price',
        'language',
        'enrolled',
        'you_get',
        'chips',
        'short_description',
        'instructor_list',
        'faq_list',
        'description',
        'feedback_list',
        'intro_video',
        'is_live',
        'serial',
        'url',
        'slug',
        'total_seats',
        'tags',
        'course_outline',
    ];
    types = [
        'string',
        'integer',
        'integer',
        'string',
        'integer',
        'object',
        'object',
        'string',
        'object',
        'object',
        'string',
        'object',
        'string',
        'boolean',
        'integer',
        'string',
        'string',
        'integer',
        'object',
        'string',
    ];

    getColumns = () => {
        let result = '(';
        this.cols.forEach((column, index) => {
            result += column;
            if (index < this.cols.length - 1) result += ',';
        });
        return `${result})`;
    };

    getWildCards = () => {
        let result = '(';
        this.cols.forEach((_, index) => {
            result += `$${index + 1}`;
            if (index < this.cols.length - 1) result += ',';
        });
        return `${result})`;
    };

    getUpdatePairs = () => {
        let result = '';
        this.cols.forEach((column, index) => {
            result += `\n                ${column} = $${index + 1}`;
            if (index < this.cols.length - 1) result += ',';
        });
        return result;
    };

    normalizeColumnValue = (column, value) => {
        const columnIndex = this.cols.indexOf(column);
        const columnType = this.types[columnIndex];

        if (columnType !== 'object' || value === undefined || value === null) {
            return value;
        }

        if (typeof value === 'string') {
            return value;
        }

        return JSON.stringify(value);
    };

    async create(reqObj) {
        const query = `
            insert into ${this.table}${this.getColumns()} values ${this.getWildCards()} returning ${this.pk}
        `;
        const params = this.cols.map((column) => this.normalizeColumnValue(column, reqObj[column]));
        return this.query(query, params);
    }

    async update(id, reqObj) {
        const query = `
            update ${this.table} set ${this.getUpdatePairs()} where ${this.pk}=$${this.cols.length + 1}
        `;
        const params = [
            ...this.cols.map((column) => this.normalizeColumnValue(column, reqObj[column])),
            id,
        ];
        return this.query(query, params);
    }

    async get(id) {
        const query = `select * from ${this.table} where ${this.pk}=$1`;
        return this.query(query, [id]);
    }

    async getFull(id) {
        const courseData = await this.get(id);
        if (!courseData.success || courseData.data.length === 0) {
            return {
                success: false,
                data: null,
            };
        }

        const resultObject = courseData.data[0];
        let chapters = await this.chapterService.list(id);
        chapters = chapters.data;

        const moduleRequests = chapters.map((chapter) => this.moduleService.list(chapter.id));
        const modulesData = await Promise.all(moduleRequests);

        modulesData.forEach((moduleResult, index) => {
            chapters[index].modules = moduleResult.data;
        });

        resultObject.chapters = chapters;

        // Books a student can optionally include with this course (read-only surfacing).
        try {
            const BookService = require('./book').BookService;
            const bookService = new BookService();
            const booksResult = await bookService.booksForCourse(id);
            resultObject.books = booksResult.success ? booksResult.data : [];
        } catch (error) {
            console.error('Error fetching books for course (getFull):', error);
            resultObject.books = [];
        }

        return {
            success: true,
            ...resultObject,
        };
    }

    async list(req, access) {
        if (access && access.hasGlobalAccess) {
            return this.query(`select * from ${this.table} order by serial`, []);
        }

        if (access && !access.hasGlobalAccess) {
            return this.query(`select * from ${this.table} where id = ANY($1) order by serial`, [access.courseIds]);
        }

        return this.query(`select * from ${this.table} order by serial`, []);
    }

    async updateFull(id, reqObj) {
        const updatePairs = [];

        (reqObj.chapters || []).forEach((chapter) => {
            (chapter.modules || []).forEach((module) => {
                updatePairs.push({
                    module_id: module.id,
                    serial: module.serial,
                });
            });
        });

        if (updatePairs.length === 0) {
            return {
                success: true,
                data: reqObj,
            };
        }

        let valuesString = '';
        updatePairs.forEach((updatePair, index) => {
            valuesString += `(${updatePair.module_id},${updatePair.serial})${index < updatePairs.length - 1 ? ',' : ''}`;
        });

        const query = `
            UPDATE module
            SET serial = v.serial
            FROM (VALUES ${valuesString}) v(id, serial)
            WHERE v.id = module.id;
        `;

        await this.query(query, []);

        return {
            success: true,
            data: reqObj,
        };
    }

    async deleteEntry(id) {
        const query = `delete from ${this.table} where ${this.pk}=$1`;
        return this.query(query, [id]);
    }

    async getUserProgress(userId, courseId) {
        const query = `SELECT
    managerial_auth.id AS user_id,chapter.id as chapter_id,chapter.title as chapter_name,
    COUNT(DISTINCT module.id) AS total_modules_assigned,
    COUNT(DISTINCT module.id) FILTER (WHERE progress.point IS NOT NULL) AS completed_modules,
    ROUND(
        (COUNT(DISTINCT module.id) FILTER (WHERE progress.point IS NOT NULL)::decimal / NULLIF(COUNT(DISTINCT module.id), 0)) * 100,
        2
    ) AS completion_percentage,
    COALESCE(
        json_agg(
            jsonb_build_object(
                'moduleId', module.id,
                'moduleName', module.title,
                'point', progress.point,
                'moduleMaxScore',module.score,
                'moduleType', module.data->>'category'
            ) ORDER BY module.id
        ) FILTER (WHERE module.id IS NOT NULL),
        '[]'::json
    ) AS modules
FROM
    managerial_auth
LEFT JOIN takes ON takes.user_id = managerial_auth.id
LEFT JOIN course ON course.id = $1
LEFT JOIN chapter ON chapter.course_id = course.id
LEFT JOIN module ON module.chapter_id = chapter.id
LEFT JOIN progress ON progress.user_id = managerial_auth.id AND progress.module_id = module.id
WHERE managerial_auth.id = $2
GROUP BY
    managerial_auth.id,
    chapter.id
ORDER BY
    chapter.id;`;

        return this.query(query, [courseId, userId]);
    }

    /**
     * Reorder modules across chapters
     * @param {number} courseId - Course ID
     * @param {array} moduleOrders - Array of {module_id, chapter_id, serial}
     * @returns {Promise<object>} Reorder result
     */
    async reorderModules(courseId, moduleOrders) {
        try {
            // Verify course exists
            const courseResult = await this.get(courseId);
            if (!courseResult.success || courseResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Course not found',
                    code: 'COURSE_NOT_FOUND'
                };
            }

            if (!Array.isArray(moduleOrders) || moduleOrders.length === 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: {
                        module_orders: 'Module orders must be a non-empty array'
                    }
                };
            }

            // Validate structure of each order
            for (let i = 0; i < moduleOrders.length; i++) {
                const order = moduleOrders[i];
                if (!order || typeof order !== 'object') {
                    return {
                        success: false,
                        error: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: {
                            [`module_orders[${i}]`]: 'Each order must be an object'
                        }
                    };
                }
                if (order.module_id === undefined || order.chapter_id === undefined || order.serial === undefined) {
                    return {
                        success: false,
                        error: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: {
                            [`module_orders[${i}]`]: 'Each order must have module_id, chapter_id, and serial'
                        }
                    };
                }
            }

            // Validate all module_ids and chapter_ids exist
            const validationErrors = {};
            const moduleIds = moduleOrders.map(m => m.module_id);
            const chapterIds = [...new Set(moduleOrders.map(m => m.chapter_id))];

            // Check modules exist and belong to course
            const moduleCheckQuery = `
                SELECT m.id, m.chapter_id, c.course_id
                FROM module m
                JOIN chapter c ON m.chapter_id = c.id
                WHERE m.id = ANY($1) AND c.course_id = $2
            `;
            const moduleCheckResult = await this.query(moduleCheckQuery, [moduleIds, courseId]);

            if (!moduleCheckResult.success) {
                return {
                    success: false,
                    error: 'Failed to validate modules',
                    code: 'VALIDATION_ERROR'
                };
            }

            const validModules = moduleCheckResult.data;
            const validModuleIds = new Set(validModules.map(m => m.id));
            const moduleChapterMap = new Map(validModules.map(m => [m.id, m.chapter_id]));

            // Check chapters exist and belong to course
            const chapterCheckQuery = `
                SELECT id FROM chapter WHERE id = ANY($1) AND course_id = $2
            `;
            const chapterCheckResult = await this.query(chapterCheckQuery, [chapterIds, courseId]);

            if (!chapterCheckResult.success) {
                return {
                    success: false,
                    error: 'Failed to validate chapters',
                    code: 'VALIDATION_ERROR'
                };
            }

            const validChapterIds = new Set(chapterCheckResult.data.map(c => c.id));

            // Validate each module order
            const chapterSerials = {}; // Track serials per chapter

            for (const order of moduleOrders) {
                const { module_id, chapter_id, serial } = order;

                // Check module exists
                if (!validModuleIds.has(module_id)) {
                    validationErrors[`module_${module_id}`] = 'Module does not exist or does not belong to this course';
                    continue;
                }

                // Check chapter exists
                if (!validChapterIds.has(chapter_id)) {
                    validationErrors[`module_${module_id}`] = 'Chapter does not exist or does not belong to this course';
                    continue;
                }

                // Check module belongs to specified chapter (if moving)
                const originalChapterId = moduleChapterMap.get(module_id);
                if (originalChapterId !== chapter_id) {
                    // Module is being moved - this is allowed
                }

                // Track serials per chapter
                if (!chapterSerials[chapter_id]) {
                    chapterSerials[chapter_id] = [];
                }
                chapterSerials[chapter_id].push(serial);
            }

            // Check for duplicate serials within each chapter
            for (const [chapterId, serials] of Object.entries(chapterSerials)) {
                const duplicates = serials.filter((s, i) => serials.indexOf(s) !== i);
                if (duplicates.length > 0) {
                    validationErrors[`chapter_${chapterId}`] = 'Duplicate serial numbers found';
                }

                // Check serials are sequential (optional - can be relaxed)
                const sortedSerials = [...serials].sort((a, b) => a - b);
                for (let i = 0; i < sortedSerials.length; i++) {
                    if (sortedSerials[i] !== i + 1) {
                        // Not strictly sequential, but we'll allow it
                        // Just warn if needed
                    }
                }
            }

            if (Object.keys(validationErrors).length > 0) {
                return {
                    success: false,
                    error: 'Invalid serialization',
                    code: 'VALIDATION_ERROR',
                    details: validationErrors
                };
            }

            // Perform updates in transaction
            const client = await this.getClient();
            try {
                await client.query('BEGIN');

                for (const order of moduleOrders) {
                    const { module_id, chapter_id, serial } = order;
                    
                    // Validate order fields are not null/undefined
                    if (module_id === null || module_id === undefined || 
                        chapter_id === null || chapter_id === undefined || 
                        serial === null || serial === undefined) {
                        throw new Error(`Invalid order: module_id, chapter_id, and serial are required`);
                    }
                    
                    const updateQuery = `
                        UPDATE module 
                        SET serial = $1, chapter_id = $2
                        WHERE id = $3
                    `;
                    await client.query(updateQuery, [serial, chapter_id, module_id]);
                }

                await client.query('COMMIT');

                return {
                    success: true,
                    data: {
                        updated_count: moduleOrders.length,
                        message: 'Module order updated successfully'
                    }
                };
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error reordering modules:', error);
            return {
                success: false,
                error: 'Failed to reorder modules',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Create import tracking record
     * @param {string} format - 'csv' or 'json'
     * @param {string} importMode - 'create', 'update', 'upsert'
     * @param {number} createdBy - Admin user ID
     * @returns {Promise<object>} Import tracking record
     */
    async createImportTracking(format, importMode, createdBy) {
        try {
            const importId = `import_${Date.now()}_${uuidv4().substring(0, 8)}`;

            const insertQuery = `
                INSERT INTO course_import_tracking (
                    import_id, format, import_mode, status, created_by, started_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING import_id, status, started_at
            `;

            const result = await this.query(insertQuery, [
                importId,
                format,
                importMode,
                'processing',
                createdBy
            ]);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to create import tracking',
                    code: 'IMPORT_TRACKING_FAILED'
                };
            }

            return {
                success: true,
                data: result.data[0]
            };
        } catch (error) {
            console.error('Error creating import tracking:', error);
            return {
                success: false,
                error: 'Failed to create import tracking',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Update import tracking status
     * @param {string} importId - Import ID
     * @param {object} updateData - Update data
     * @returns {Promise<object>} Update result
     */
    async updateImportTracking(importId, updateData) {
        try {
            const updateFields = [];
            const updateParams = [];
            let paramIndex = 1;

            if (updateData.status !== undefined) {
                updateFields.push(`status = $${paramIndex}`);
                updateParams.push(updateData.status);
                paramIndex++;
            }

            if (updateData.course_id !== undefined) {
                updateFields.push(`course_id = $${paramIndex}`);
                updateParams.push(updateData.course_id);
                paramIndex++;
            }

            if (updateData.summary !== undefined) {
                updateFields.push(`summary = $${paramIndex}`);
                updateParams.push(JSON.stringify(updateData.summary));
                paramIndex++;
            }

            if (updateData.errors !== undefined) {
                updateFields.push(`errors = $${paramIndex}`);
                updateParams.push(JSON.stringify(updateData.errors));
                paramIndex++;
            }

            if (updateData.warnings !== undefined) {
                updateFields.push(`warnings = $${paramIndex}`);
                updateParams.push(JSON.stringify(updateData.warnings));
                paramIndex++;
            }

            if (updateData.progress !== undefined) {
                updateFields.push(`progress = $${paramIndex}`);
                updateParams.push(JSON.stringify(updateData.progress));
                paramIndex++;
            }

            if (updateData.status === 'completed' || updateData.status === 'failed' || updateData.status === 'partial') {
                updateFields.push(`completed_at = NOW()`);
            }

            if (updateFields.length === 0) {
                return { success: true };
            }

            updateParams.push(importId);

            const updateQuery = `
                UPDATE course_import_tracking
                SET ${updateFields.join(', ')}
                WHERE import_id = $${paramIndex}
                RETURNING import_id, status
            `;

            const result = await this.query(updateQuery, updateParams);

            return {
                success: result.success,
                data: result.data[0]
            };
        } catch (error) {
            console.error('Error updating import tracking:', error);
            return {
                success: false,
                error: 'Failed to update import tracking',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Get import tracking status
     * @param {string} importId - Import ID
     * @returns {Promise<object>} Import tracking data
     */
    async getImportTracking(importId) {
        try {
            const query = `
                SELECT * FROM course_import_tracking
                WHERE import_id = $1
            `;

            const result = await this.query(query, [importId]);

            if (!result.success || result.data.length === 0) {
                return {
                    success: false,
                    error: 'Import not found',
                    code: 'IMPORT_NOT_FOUND'
                };
            }

            const importData = result.data[0];

            return {
                success: true,
                data: {
                    import_id: importData.import_id,
                    course_id: importData.course_id,
                    status: importData.status,
                    format: importData.format,
                    import_mode: importData.import_mode,
                    summary: importData.summary,
                    errors: importData.errors,
                    warnings: importData.warnings,
                    progress: importData.progress,
                    started_at: importData.started_at,
                    completed_at: importData.completed_at
                }
            };
        } catch (error) {
            console.error('Error getting import tracking:', error);
            return {
                success: false,
                error: 'Failed to get import tracking',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    /**
     * Enhanced getFull - includes new Phase 8 fields
     * @param {number} courseId - Course ID
     * @returns {Promise<object>} Full course data with enhanced fields
     */
    async getFullEnhanced(courseId) {
        try {
            const fullResult = await this.getFull(courseId);

            if (!fullResult.success || !fullResult.chapters) {
                return fullResult;
            }

            // Enhance modules with new Phase 8 fields
            // Ensure chapters is an array
            if (!Array.isArray(fullResult.chapters)) {
                fullResult.chapters = [];
            }

            for (const chapter of fullResult.chapters) {
                if (!chapter) continue; // Skip null/undefined chapters
                
                if (chapter.modules && Array.isArray(chapter.modules)) {
                    for (const module of chapter.modules) {
                        if (!module) continue; // Skip null/undefined modules

                        // Ensure all new fields are present (even if null)
                        if (module.quiz_time_limit === undefined) {
                            module.quiz_time_limit = null;
                        }
                        if (module.quiz_attempt_limit === undefined) {
                            module.quiz_attempt_limit = null;
                        }
                        if (module.pdf_drive_link === undefined) {
                            module.pdf_drive_link = null;
                        }

                        // Add pdf_drive_link to data if exists
                        if (module.pdf_drive_link && module.data) {
                            module.data.pdf_drive_link = module.pdf_drive_link;
                        }
                    }
                }
            }

            // Ensure response format matches frontend expectations
            // getFull returns { success: true, id, title, chapters, ... } (spread)
            // Frontend expects { success: true, data: { id, title, chapters, ... } }
            if (fullResult.success) {
                // Extract all fields except 'success' and wrap in 'data'
                const { success, ...courseData } = fullResult;
                return {
                    success: true,
                    data: courseData
                };
            }

            return fullResult;
        } catch (error) {
            console.error('Error in getFullEnhanced:', error);
            return {
                success: false,
                error: 'Failed to get full course data',
                code: 'INTERNAL_SERVER_ERROR'
            };
        }
    }
}

module.exports = { CourseServiceV2 };
