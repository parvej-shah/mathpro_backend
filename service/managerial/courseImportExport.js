/**
 * Course Import/Export Service for Phase 8
 * Handles bulk course import from CSV/JSON and export to CSV/JSON
 * 
 * Note: Requires 'csv-parser' package for CSV parsing
 * Install with: npm install csv-parser
 */

const ChapterService = require('./chapter').ChapterService;
const ModuleService = require('./module').ModuleService;
const CourseServiceV2 = require('./courseV2').CourseServiceV2;
const ErrorHandler = require('../../util/errorHandler');
const { Readable } = require('stream');
const presignedUploadService = require('../../util/presignedUploadService');

// csv-parser is now installed
const csvParser = require('csv-parser');

class CourseImportExportService extends CourseServiceV2 {
    constructor() {
        super();
        this.chapterService = new ChapterService();
        this.moduleService = new ModuleService();
    }

    /**
     * Validate course data structure (strict validation - fails on first error)
     * @param {object} courseData - Course data object
     * @returns {object} Validation result
     */
    validateCourseData(courseData) {
        const errors = {};

        if (!courseData.title || typeof courseData.title !== 'string' || courseData.title.trim() === '') {
            errors.title = 'Course title is required';
            return { valid: false, errors };
        }

        if (courseData.language && !['বাংলা', 'English'].includes(courseData.language)) {
            errors.language = 'Language must be either "বাংলা" or "English"';
            return { valid: false, errors };
        }

        if (courseData.price !== undefined && (typeof courseData.price !== 'number' || courseData.price < 0)) {
            errors.price = 'Price must be a non-negative number';
            return { valid: false, errors };
        }

        return { valid: true, errors: {} };
    }

    /**
     * Validate chapter data structure
     * @param {object} chapterData - Chapter data object
     * @param {number} index - Chapter index for error reporting
     * @returns {object} Validation result
     */
    validateChapterData(chapterData, index) {
        const errors = {};

        if (!chapterData.serial || typeof chapterData.serial !== 'number' || chapterData.serial < 1) {
            errors[`chapters[${index}].serial`] = 'Chapter serial must be a positive integer';
            return { valid: false, errors };
        }

        if (!chapterData.title || typeof chapterData.title !== 'string' || chapterData.title.trim() === '') {
            errors[`chapters[${index}].title`] = 'Chapter title is required';
            return { valid: false, errors };
        }

        if (chapterData.is_free !== undefined && typeof chapterData.is_free !== 'boolean') {
            errors[`chapters[${index}].is_free`] = 'is_free must be a boolean';
            return { valid: false, errors };
        }

        if (chapterData.is_live !== undefined && typeof chapterData.is_live !== 'boolean') {
            errors[`chapters[${index}].is_live`] = 'is_live must be a boolean';
            return { valid: false, errors };
        }

        return { valid: true, errors: {} };
    }

    /**
     * Validate module data structure
     * @param {object} moduleData - Module data object
     * @param {number} chapterIndex - Chapter index
     * @param {number} moduleIndex - Module index
     * @returns {object} Validation result
     */
    validateModuleData(moduleData, chapterIndex, moduleIndex) {
        const errors = {};

        if (!moduleData.serial || typeof moduleData.serial !== 'number' || moduleData.serial < 1) {
            errors[`chapters[${chapterIndex}].modules[${moduleIndex}].serial`] = 'Module serial must be a positive integer';
            return { valid: false, errors };
        }

        if (!moduleData.title || typeof moduleData.title !== 'string' || moduleData.title.trim() === '') {
            errors[`chapters[${chapterIndex}].modules[${moduleIndex}].title`] = 'Module title is required';
            return { valid: false, errors };
        }

        const validCategories = ['VIDEO', 'QUIZ', 'PDF', 'TEXT'];
        if (!moduleData.category || !validCategories.includes(moduleData.category)) {
            errors[`chapters[${chapterIndex}].modules[${moduleIndex}].category`] = `Category must be one of: ${validCategories.join(', ')}`;
            return { valid: false, errors };
        }

        if (moduleData.score !== undefined && (typeof moduleData.score !== 'number' || moduleData.score < 0)) {
            errors[`chapters[${chapterIndex}].modules[${moduleIndex}].score`] = 'Score must be a non-negative number';
            return { valid: false, errors };
        }

        if (moduleData.is_live !== undefined && typeof moduleData.is_live !== 'boolean') {
            errors[`chapters[${chapterIndex}].modules[${moduleIndex}].is_live`] = 'is_live must be a boolean';
            return { valid: false, errors };
        }

        if (moduleData.is_free !== undefined && typeof moduleData.is_free !== 'boolean') {
            errors[`chapters[${chapterIndex}].modules[${moduleIndex}].is_free`] = 'is_free must be a boolean';
            return { valid: false, errors };
        }

        // Validate category-specific data
        if (moduleData.category === 'QUIZ' && moduleData.data?.quiz) {
            // Quiz validation - answers should already be encrypted by frontend
            if (!Array.isArray(moduleData.data.quiz)) {
                errors[`chapters[${chapterIndex}].modules[${moduleIndex}].data.quiz`] = 'Quiz must be an array';
                return { valid: false, errors };
            }
        }

        return { valid: true, errors: {} };
    }

    /**
     * Parse JSON import content
     * @param {string} fileContent - JSON file content
     * @returns {Promise<object>} Parsed course data
     */
    async parseJSONFile(fileContent) {
        try {
            const courseData = JSON.parse(fileContent);

            // Validate structure
            if (!courseData.course) {
                return {
                    success: false,
                    error: 'Invalid JSON format: missing course object',
                    code: 'IMPORT_PARSING_ERROR'
                };
            }

            if (!courseData.chapters || !Array.isArray(courseData.chapters)) {
                return {
                    success: false,
                    error: 'Invalid JSON format: missing chapters array',
                    code: 'IMPORT_PARSING_ERROR'
                };
            }

            return {
                success: true,
                data: courseData
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to parse JSON file: ${error.message}`,
                code: 'IMPORT_PARSING_ERROR'
            };
        }
    }

    /**
     * Parse CSV import content (requires csv-parser)
     * @param {string} fileContent - CSV file content
     * @returns {Promise<object>} Parsed course data
     */
    async parseCSVFile(fileContent) {
        if (!csvParser) {
            return {
                success: false,
                error: 'CSV parsing not available. Please install csv-parser: npm install csv-parser',
                code: 'CSV_PARSER_NOT_AVAILABLE'
            };
        }

        return new Promise((resolve) => {
            const results = [];
            const errors = [];

            Readable.from([fileContent])
                .pipe(csvParser())
                .on('data', (data) => {
                    results.push(data);
                })
                .on('error', (error) => {
                    errors.push(error.message);
                })
                .on('end', () => {
                    if (errors.length > 0) {
                        resolve({
                            success: false,
                            error: `CSV parsing errors: ${errors.join(', ')}`,
                            code: 'IMPORT_PARSING_ERROR'
                        });
                    } else {
                        // Convert CSV rows to course structure
                        // This is a simplified conversion - full implementation would be more complex
                        resolve({
                            success: true,
                            data: this.convertCSVToCourseStructure(results)
                        });
                    }
                });
        });
    }

    /**
     * Convert CSV rows to course structure
     * @param {array} csvRows - Array of CSV row objects
     * @returns {object} Course structure
     */
    convertCSVToCourseStructure(csvRows) {
        if (csvRows.length === 0) {
            return { course: {}, chapters: [] };
        }

        // Get course data from first row
        const firstRow = csvRows[0];
        const course = {
            title: firstRow.course_title,
            description: firstRow.course_description || null,
            language: firstRow.course_language,
            price: parseInt(firstRow.course_price) || 0,
            x_price: parseInt(firstRow.course_x_price) || 0
        };

        // Group rows by chapter
        const chaptersMap = new Map();
        
        for (const row of csvRows) {
            const chapterSerial = parseInt(row.chapter_serial);
            const chapterKey = `chapter_${chapterSerial}`;

            if (!chaptersMap.has(chapterKey)) {
                chaptersMap.set(chapterKey, {
                    serial: chapterSerial,
                    title: row.chapter_title,
                    is_free: row.chapter_is_free === 'true',
                    is_live: row.chapter_is_live === 'true',
                    modules: []
                });
            }

            const chapter = chaptersMap.get(chapterKey);
            const moduleData = {
                serial: parseInt(row.module_serial),
                title: row.module_title,
                category: row.module_category,
                score: parseInt(row.module_score) || 0,
                is_live: row.module_is_live === 'true',
                is_free: row.module_is_free === 'true',
                description: row.module_description || null,
                data: {
                    category: row.module_category
                }
            };

            // Add category-specific data
            if (row.module_category === 'VIDEO') {
                moduleData.data.videoUrl = row.module_data_videoUrl || null;
                moduleData.data.videoHost = row.module_data_videoHost || null;
                moduleData.data.pdf_drive_link = row.module_data_pdf_drive_link || null;
            } else if (row.module_category === 'QUIZ') {
                moduleData.quiz_time_limit = row.module_quiz_time_limit ? parseInt(row.module_quiz_time_limit) : null;
                moduleData.quiz_attempt_limit = row.module_quiz_attempt_limit ? parseInt(row.module_quiz_attempt_limit) : null;
            } else if (row.module_category === 'PDF') {
                moduleData.data.pdf_link = row.module_data_pdf_link || null;
                moduleData.data.pdf_drive_link = row.module_data_pdf_drive_link || null;
                moduleData.data.pdf_source = row.module_data_pdf_source || 's3';
            }

            chapter.modules.push(moduleData);
        }

        const chapters = Array.from(chaptersMap.values()).sort((a, b) => a.serial - b.serial);

        return { course, chapters };
    }

    /**
     * Import course from S3 key (async processing)
     * @param {string} uploadKey - S3 object key for import file
     * @param {string} format - 'csv' or 'json'
     * @param {string} importMode - 'create', 'update', 'upsert'
     * @param {number} createdBy - Admin user ID
     * @param {boolean} validateOnly - Only validate, don't import
     * @returns {Promise<object>} Import result with import_id
     */
    async importCourse(uploadKey, format, importMode, createdBy, validateOnly = false) {
        try {
            // Create import tracking immediately
            const trackingResult = await this.createImportTracking(format, importMode, createdBy);
            if (!trackingResult.success) {
                return trackingResult;
            }

            const importId = trackingResult.data.import_id;

            // Process import asynchronously (don't await)
            this.processImport(uploadKey, format, importMode, createdBy, importId, validateOnly)
                .catch(error => {
                    console.error('Error in async import processing:', error);
                    this.updateImportTracking(importId, {
                        status: 'failed',
                        errors: [{ error: error.message }]
                    });
                });

            // Return immediately with import_id
            return {
                success: true,
                data: {
                    import_id: importId,
                    status: 'processing',
                    message: validateOnly ? 'Validation started' : 'Import started'
                }
            };
        } catch (error) {
            console.error('Error starting import:', error);
            return {
                success: false,
                error: 'Failed to start import',
                code: 'IMPORT_START_FAILED'
            };
        }
    }

    /**
     * Process import (async)
     * @private
     */
    async processImport(uploadKey, format, importMode, createdBy, importId, validateOnly) {
        try {
            const fileContent = await presignedUploadService.getObjectText(uploadKey);

            // Parse file
            let parseResult;
            if (format === 'json') {
                parseResult = await this.parseJSONFile(fileContent);
            } else if (format === 'csv') {
                parseResult = await this.parseCSVFile(fileContent);
            } else {
                await this.updateImportTracking(importId, {
                    status: 'failed',
                    errors: [{ error: `Unsupported format: ${format}` }]
                });
                return;
            }

            if (!parseResult.success) {
                await this.updateImportTracking(importId, {
                    status: 'failed',
                    errors: [{ error: parseResult.error }]
                });
                return;
            }

            const courseData = parseResult.data;

            // Strict validation - fail on first error
            const courseValidation = this.validateCourseData(courseData.course);
            if (!courseValidation.valid) {
                await this.updateImportTracking(importId, {
                    status: 'failed',
                    errors: [{ type: 'course', error: courseValidation.errors }]
                });
                return;
            }

            // Validate chapters
            if (!courseData.chapters || !Array.isArray(courseData.chapters)) {
                await this.updateImportTracking(importId, {
                    status: 'failed',
                    errors: [{ type: 'chapters', error: 'Chapters array is required' }]
                });
                return;
            }

            const chapterErrors = {};
            for (let i = 0; i < courseData.chapters.length; i++) {
                const chapter = courseData.chapters[i];
                if (!chapter) {
                    chapterErrors[`chapter_${i}`] = 'Chapter is null or undefined';
                    continue;
                }
                const chapterValidation = this.validateChapterData(chapter, i);
                if (!chapterValidation.valid) {
                    Object.assign(chapterErrors, chapterValidation.errors);
                }
            }

            if (Object.keys(chapterErrors).length > 0) {
                await this.updateImportTracking(importId, {
                    status: 'failed',
                    errors: [{ type: 'chapters', error: chapterErrors }]
                });
                return;
            }

            // Validate modules
            const moduleErrors = {};
            for (let i = 0; i < courseData.chapters.length; i++) {
                const chapter = courseData.chapters[i];
                if (!chapter) continue; // Skip null chapters
                
                if (chapter.modules && Array.isArray(chapter.modules)) {
                    for (let j = 0; j < chapter.modules.length; j++) {
                        const module = chapter.modules[j];
                        if (!module) {
                            moduleErrors[`chapter_${i}_module_${j}`] = 'Module is null or undefined';
                            continue;
                        }
                        const moduleValidation = this.validateModuleData(module, i, j);
                        if (!moduleValidation.valid) {
                            Object.assign(moduleErrors, moduleValidation.errors);
                        }
                    }
                }
            }

            if (Object.keys(moduleErrors).length > 0) {
                await this.updateImportTracking(importId, {
                    status: 'failed',
                    errors: [{ type: 'modules', error: moduleErrors }]
                });
                return;
            }

            if (validateOnly) {
                // Return validation summary
                const summary = {
                    total_chapters: courseData.chapters.length,
                    total_modules: courseData.chapters.reduce((sum, ch) => sum + (ch.modules?.length || 0), 0),
                    modules_by_type: {}
                };

                courseData.chapters.forEach(ch => {
                    if (ch && ch.modules && Array.isArray(ch.modules)) {
                        ch.modules.forEach(mod => {
                            if (mod && mod.category) {
                                summary.modules_by_type[mod.category] = (summary.modules_by_type[mod.category] || 0) + 1;
                            }
                        });
                    }
                });

                await this.updateImportTracking(importId, {
                    status: 'completed',
                    summary: summary
                });
                return;
            }

            // Actually import the course
            const client = await this.getClient();
            let courseId = null;

            try {
                await client.query('BEGIN');

                // Handle import modes
                if (importMode === 'create') {
                    // Check if course with same title exists
                    const existingCourseQuery = `SELECT id FROM course WHERE title = $1`;
                    const existingResult = await client.query(existingCourseQuery, [courseData.course.title]);
                    
                    if (existingResult.rows.length > 0) {
                        await client.query('ROLLBACK');
                        await this.updateImportTracking(importId, {
                            status: 'failed',
                            errors: [{ error: `Course with title "${courseData.course.title}" already exists` }]
                        });
                        return;
                    }

                    // Create course
                    const courseInsertQuery = `
                        INSERT INTO course (
                            title, description, language, price, x_price, 
                            short_description, intro_video, url, enrolled, is_live, serial
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                            (SELECT COALESCE(MAX(serial), 0) + 1 FROM course)
                        ) RETURNING id
                    `;
                    const courseResult = await client.query(courseInsertQuery, [
                        courseData.course.title,
                        courseData.course.description || null,
                        courseData.course.language || 'English',
                        courseData.course.price || 0,
                        courseData.course.x_price || 0,
                        courseData.course.short_description || null,
                        courseData.course.intro_video || null,
                        courseData.course.url || null,
                        courseData.course.enrolled || 0,
                        courseData.course.is_live !== undefined ? courseData.course.is_live : true
                    ]);
                    if (!courseResult.rows || courseResult.rows.length === 0) {
                        await client.query('ROLLBACK');
                        await this.updateImportTracking(importId, {
                            status: 'failed',
                            errors: [{ error: 'Failed to create course' }]
                        });
                        return;
                    }
                    courseId = courseResult.rows[0].id;

                } else if (importMode === 'update') {
                    // Find course by title or use provided ID
                    const findCourseQuery = courseData.course.id 
                        ? `SELECT id FROM course WHERE id = $1`
                        : `SELECT id FROM course WHERE title = $1`;
                    const findResult = await client.query(findCourseQuery, [
                        courseData.course.id || courseData.course.title
                    ]);

                    if (findResult.rows.length === 0) {
                        await client.query('ROLLBACK');
                        await this.updateImportTracking(importId, {
                            status: 'failed',
                            errors: [{ error: 'Course not found for update' }]
                        });
                        return;
                    }

                    courseId = findResult.rows[0].id;

                    // Update course
                    const courseUpdateQuery = `
                        UPDATE course SET
                            title = $1, description = $2, language = $3, price = $4, x_price = $5,
                            short_description = $6, intro_video = $7, url = $8, is_live = $9
                        WHERE id = $10
                    `;
                    await client.query(courseUpdateQuery, [
                        courseData.course.title,
                        courseData.course.description || null,
                        courseData.course.language || 'English',
                        courseData.course.price || 0,
                        courseData.course.x_price || 0,
                        courseData.course.short_description || null,
                        courseData.course.intro_video || null,
                        courseData.course.url || null,
                        courseData.course.is_live !== undefined ? courseData.course.is_live : true,
                        courseId
                    ]);

                } else if (importMode === 'upsert') {
                    // Try to find existing course
                    const findCourseQuery = courseData.course.id 
                        ? `SELECT id FROM course WHERE id = $1`
                        : `SELECT id FROM course WHERE title = $1`;
                    const findResult = await client.query(findCourseQuery, [
                        courseData.course.id || courseData.course.title
                    ]);

                    if (findResult.rows.length > 0) {
                        // Update existing
                        courseId = findResult.rows[0].id;
                        const courseUpdateQuery = `
                            UPDATE course SET
                                title = $1, description = $2, language = $3, price = $4, x_price = $5,
                                short_description = $6, intro_video = $7, url = $8, is_live = $9
                            WHERE id = $10
                        `;
                        await client.query(courseUpdateQuery, [
                            courseData.course.title,
                            courseData.course.description || null,
                            courseData.course.language || 'English',
                            courseData.course.price || 0,
                            courseData.course.x_price || 0,
                            courseData.course.short_description || null,
                            courseData.course.intro_video || null,
                            courseData.course.url || null,
                            courseData.course.is_live !== undefined ? courseData.course.is_live : true,
                            courseId
                        ]);
                    } else {
                        // Create new
                        const courseInsertQuery = `
                            INSERT INTO course (
                                title, description, language, price, x_price, 
                                short_description, intro_video, url, enrolled, is_live, serial
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                                (SELECT COALESCE(MAX(serial), 0) + 1 FROM course)
                            ) RETURNING id
                        `;
                        const courseResult = await client.query(courseInsertQuery, [
                            courseData.course.title,
                            courseData.course.description || null,
                            courseData.course.language || 'English',
                            courseData.course.price || 0,
                            courseData.course.x_price || 0,
                            courseData.course.short_description || null,
                            courseData.course.intro_video || null,
                            courseData.course.url || null,
                            courseData.course.enrolled || 0,
                            courseData.course.is_live !== undefined ? courseData.course.is_live : true
                        ]);
                        courseId = courseResult.rows[0].id;
                    }
                }

                // Process chapters and modules
                let chaptersCreated = 0;
                let modulesCreated = 0;

                for (const chapterData of courseData.chapters) {
                    if (!chapterData) continue; // Skip null/undefined chapters
                    
                    let chapterId;

                    if (importMode === 'update' || importMode === 'upsert') {
                        // Try to find existing chapter by serial
                        const findChapterQuery = `
                            SELECT id FROM chapter 
                            WHERE course_id = $1 AND serial = $2
                        `;
                        const findChapterResult = await client.query(findChapterQuery, [courseId, chapterData.serial]);

                        if (findChapterResult.rows.length > 0) {
                            // Update existing chapter
                            chapterId = findChapterResult.rows[0].id;
                            const updateChapterQuery = `
                                UPDATE chapter SET
                                    title = $1, is_free = $2, is_live = $3
                                WHERE id = $4
                            `;
                            await client.query(updateChapterQuery, [
                                chapterData.title,
                                chapterData.is_free !== undefined ? chapterData.is_free : false,
                                chapterData.is_live !== undefined ? chapterData.is_live : true,
                                chapterId
                            ]);
                        } else {
                            // Create new chapter
                            const insertChapterQuery = `
                                INSERT INTO chapter (course_id, serial, title, is_free, is_live)
                                VALUES ($1, $2, $3, $4, $5)
                                RETURNING id
                            `;
                            const chapterResult = await client.query(insertChapterQuery, [
                                courseId,
                                chapterData.serial,
                                chapterData.title,
                                chapterData.is_free !== undefined ? chapterData.is_free : false,
                                chapterData.is_live !== undefined ? chapterData.is_live : true
                            ]);
                            if (!chapterResult.rows || chapterResult.rows.length === 0) {
                                throw new Error(`Failed to create chapter: ${chapterData.title}`);
                            }
                            chapterId = chapterResult.rows[0].id;
                            chaptersCreated++;
                        }
                    } else {
                        // Create mode - always create new
                        const insertChapterQuery = `
                            INSERT INTO chapter (course_id, serial, title, is_free, is_live)
                            VALUES ($1, $2, $3, $4, $5)
                            RETURNING id
                        `;
                        const chapterResult = await client.query(insertChapterQuery, [
                            courseId,
                            chapterData.serial,
                            chapterData.title,
                            chapterData.is_free !== undefined ? chapterData.is_free : false,
                            chapterData.is_live !== undefined ? chapterData.is_live : true
                        ]);
                            if (!chapterResult.rows || chapterResult.rows.length === 0) {
                                throw new Error(`Failed to create chapter: ${chapterData.title}`);
                            }
                            chapterId = chapterResult.rows[0].id;
                            chaptersCreated++;
                    }

                    // Process modules
                    if (chapterData.modules && Array.isArray(chapterData.modules)) {
                        for (const moduleData of chapterData.modules) {
                            if (!moduleData) continue; // Skip null/undefined modules
                            
                            let moduleId;

                            if (importMode === 'update' || importMode === 'upsert') {
                                // Try to find existing module by serial
                                const findModuleQuery = `
                                    SELECT id FROM module 
                                    WHERE chapter_id = $1 AND serial = $2
                                `;
                                const findModuleResult = await client.query(findModuleQuery, [chapterId, moduleData.serial]);

                                if (findModuleResult.rows && findModuleResult.rows.length > 0) {
                                    // Update existing module
                                    moduleId = findModuleResult.rows[0].id;
                                    const updateModuleQuery = `
                                        UPDATE module SET
                                            title = $1, description = $2, data = $3,
                                            is_live = $4, is_free = $5, serial = $6, score = $7,
                                            quiz_time_limit = $8, quiz_attempt_limit = $9,
                                            pdf_drive_link = $10
                                        WHERE id = $11
                                    `;
                                    await client.query(updateModuleQuery, [
                                        moduleData.title,
                                        moduleData.description || null,
                                        moduleData.data ? JSON.stringify(moduleData.data) : JSON.stringify({ category: moduleData.category || 'TEXT' }),
                                        moduleData.is_live !== undefined ? moduleData.is_live : true,
                                        moduleData.is_free !== undefined ? moduleData.is_free : false,
                                        moduleData.serial,
                                        moduleData.score || 0,
                                        moduleData.quiz_time_limit || null,
                                        moduleData.quiz_attempt_limit || null,
                                        (moduleData.data && moduleData.data.pdf_drive_link) ? moduleData.data.pdf_drive_link : null,
                                        moduleId
                                    ]);
                                } else {
                                    // Create new module
                                    const insertModuleQuery = `
                                        INSERT INTO module (
                                            chapter_id, serial, title, description, data,
                                            is_live, is_free, score,
                                            quiz_time_limit, quiz_attempt_limit, pdf_drive_link
                                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                                        RETURNING id
                                    `;
                                    const moduleResult = await client.query(insertModuleQuery, [
                                        chapterId,
                                        moduleData.serial,
                                        moduleData.title,
                                        moduleData.description || null,
                                        moduleData.data ? JSON.stringify(moduleData.data) : JSON.stringify({ category: moduleData.category || 'TEXT' }),
                                        moduleData.is_live !== undefined ? moduleData.is_live : true,
                                        moduleData.is_free !== undefined ? moduleData.is_free : false,
                                        moduleData.score || 0,
                                        moduleData.quiz_time_limit || null,
                                        moduleData.quiz_attempt_limit || null,
                                        (moduleData.data && moduleData.data.pdf_drive_link) ? moduleData.data.pdf_drive_link : null
                                    ]);
                                    if (!moduleResult.rows || moduleResult.rows.length === 0) {
                                        throw new Error(`Failed to create module: ${moduleData.title}`);
                                    }
                                    moduleId = moduleResult.rows[0].id;
                                    modulesCreated++;
                                }
                            } else {
                                // Create mode - always create new
                                const insertModuleQuery = `
                                    INSERT INTO module (
                                        chapter_id, serial, title, description, data,
                                        is_live, is_free, score,
                                        quiz_time_limit, quiz_attempt_limit, pdf_drive_link
                                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                                    RETURNING id
                                `;
                                const moduleResult = await client.query(insertModuleQuery, [
                                    chapterId,
                                    moduleData.serial,
                                    moduleData.title,
                                    moduleData.description || null,
                                    moduleData.data ? JSON.stringify(moduleData.data) : JSON.stringify({ category: moduleData.category || 'TEXT' }),
                                    moduleData.is_live !== undefined ? moduleData.is_live : true,
                                    moduleData.is_free !== undefined ? moduleData.is_free : false,
                                    moduleData.score || 0,
                                    moduleData.quiz_time_limit || null,
                                    moduleData.quiz_attempt_limit || null,
                                    (moduleData.data && moduleData.data.pdf_drive_link) ? moduleData.data.pdf_drive_link : null
                                ]);
                                moduleId = moduleResult.rows[0].id;
                                modulesCreated++;
                            }
                        }
                    }
                }

                await client.query('COMMIT');

                // Update import tracking with success
                await this.updateImportTracking(importId, {
                    status: 'completed',
                    course_id: courseId,
                    summary: {
                        course_created: importMode === 'create' || (importMode === 'upsert' && !courseId),
                        course_updated: importMode === 'update' || (importMode === 'upsert' && courseId),
                        chapters_created: chaptersCreated,
                        modules_created: modulesCreated
                    }
                });

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error processing import:', error);
            await this.updateImportTracking(importId, {
                status: 'failed',
                errors: [{ error: error.message }]
            });
        }
    }

    /**
     * Export course to JSON
     * @param {number} courseId - Course ID
     * @param {boolean} includeContent - Include module content
     * @param {boolean} includeQuizAnswers - Include quiz answers
     * @returns {Promise<object>} Export result
     */
    async exportCourseJSON(courseId, includeContent = true, includeQuizAnswers = false) {
        try {
            const fullResult = await this.getFullEnhanced(courseId);

            if (!fullResult.success) {
                return {
                    success: false,
                    error: 'Course not found',
                    code: 'COURSE_NOT_FOUND'
                };
            }

            const course = fullResult.data;
            const exportData = {
                version: '1.0',
                format_version: '1.0',
                exported_at: new Date().toISOString(),
                course: {
                    id: course.id,
                    title: course.title,
                    description: course.description,
                    language: course.language,
                    price: course.price,
                    x_price: course.x_price
                },
                chapters: (course.chapters || []).map(chapter => ({
                    serial: chapter.serial,
                    title: chapter.title,
                    is_free: chapter.is_free,
                    is_live: chapter.is_live,
                    modules: (chapter.modules || []).map(module => {
                        const moduleExport = {
                            serial: module.serial,
                            title: module.title,
                            category: module.data?.category || 'TEXT',
                            score: module.score,
                            is_live: module.is_live,
                            is_free: module.is_free,
                            description: module.description,
                            quiz_time_limit: module.quiz_time_limit,
                            quiz_attempt_limit: module.quiz_attempt_limit
                        };

                        if (includeContent && module.data) {
                            moduleExport.data = { ...module.data };
                            
                            // Remove quiz answers if not requested
                            if (!includeQuizAnswers && moduleExport.data.quiz) {
                                moduleExport.data.quiz = moduleExport.data.quiz.map(q => ({
                                    ...q,
                                    answer: '[ENCRYPTED]',
                                    explanation: q.explanation ? '[ENCRYPTED]' : undefined
                                }));
                            }
                        }

                        return moduleExport;
                    })
                }))
            };

            return {
                success: true,
                data: exportData
            };
        } catch (error) {
            console.error('Error exporting course:', error);
            return {
                success: false,
                error: 'Failed to export course',
                code: 'EXPORT_FAILED'
            };
        }
    }
}

module.exports = { CourseImportExportService };
