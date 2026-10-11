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
const { Readable } = require('stream');
const presignedUploadService = require('../../util/presignedUploadService');

// csv-parser is now installed
const csvParser = require('csv-parser');
const logger = require('../../util/logger');

// ---- Rows written by an import (each runs on the import's transaction client) ----

// Course columns shared by INSERT and UPDATE, in the order both queries use.
const courseColumns = (course) => [
    course.title,
    course.description || null,
    course.language || 'English',
    course.price || 0,
    course.x_price || 0,
    course.short_description || null,
    course.intro_video || null,
    course.url || null,
];
const isLive = (row) => (row.is_live !== undefined ? row.is_live : true);
const isFree = (row) => (row.is_free !== undefined ? row.is_free : false);

// Returns the new course id (null if nothing was inserted).
async function insertImportedCourse(client, course) {
    const result = await client.query(`
        INSERT INTO course (
            title, description, language, price, x_price, 
            short_description, intro_video, url, enrolled, is_live, serial
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
            (SELECT COALESCE(MAX(serial), 0) + 1 FROM course)
        ) RETURNING id
    `, [...courseColumns(course), course.enrolled || 0, isLive(course)]);
    return result.rows && result.rows.length > 0 ? result.rows[0].id : null;
}

// By `id` when the file gives one, else by title. Returns the id or null.
async function findImportedCourseId(client, course) {
    const result = await client.query(
        course.id ? `SELECT id FROM course WHERE id = $1` : `SELECT id FROM course WHERE title = $1`,
        [course.id || course.title]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
}

async function updateImportedCourse(client, course, courseId) {
    await client.query(`
        UPDATE course SET
            title = $1, description = $2, language = $3, price = $4, x_price = $5,
            short_description = $6, intro_video = $7, url = $8, is_live = $9
        WHERE id = $10
    `, [...courseColumns(course), isLive(course), courseId]);
}

async function findChapterId(client, courseId, serial) {
    const result = await client.query(`
        SELECT id FROM chapter 
        WHERE course_id = $1 AND serial = $2
    `, [courseId, serial]);
    return result.rows.length > 0 ? result.rows[0].id : null;
}

async function insertImportedChapter(client, courseId, chapter) {
    const result = await client.query(`
        INSERT INTO chapter (course_id, serial, title, is_free, is_live)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `, [courseId, chapter.serial, chapter.title, isFree(chapter), isLive(chapter)]);
    if (!result.rows || result.rows.length === 0) {
        throw new Error(`Failed to create chapter: ${chapter.title}`);
    }
    return result.rows[0].id;
}

async function updateImportedChapter(client, chapter, chapterId) {
    await client.query(`
        UPDATE chapter SET
            title = $1, is_free = $2, is_live = $3
        WHERE id = $4
    `, [chapter.title, isFree(chapter), isLive(chapter), chapterId]);
}

async function findModuleId(client, chapterId, serial) {
    const result = await client.query(`
        SELECT id FROM module 
        WHERE chapter_id = $1 AND serial = $2
    `, [chapterId, serial]);
    return result.rows && result.rows.length > 0 ? result.rows[0].id : null;
}

// `data` as stored (defaults to just the category) and the PDF link lifted out of it.
const moduleData = (mod) => (mod.data ? JSON.stringify(mod.data) : JSON.stringify({ category: mod.category || 'TEXT' }));
const modulePdfLink = (mod) => ((mod.data && mod.data.pdf_drive_link) ? mod.data.pdf_drive_link : null);

async function insertImportedModule(client, chapterId, mod) {
    const result = await client.query(`
        INSERT INTO module (
            chapter_id, serial, title, description, data,
            is_live, is_free, score,
            quiz_time_limit, quiz_attempt_limit, pdf_drive_link
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
    `, [
        chapterId, mod.serial, mod.title, mod.description || null, moduleData(mod),
        isLive(mod), isFree(mod), mod.score || 0,
        mod.quiz_time_limit || null, mod.quiz_attempt_limit || null, modulePdfLink(mod),
    ]);
    if (!result.rows || result.rows.length === 0) {
        throw new Error(`Failed to create module: ${mod.title}`);
    }
    return result.rows[0].id;
}

async function updateImportedModule(client, mod, moduleId) {
    await client.query(`
        UPDATE module SET
            title = $1, description = $2, data = $3,
            is_live = $4, is_free = $5, serial = $6, score = $7,
            quiz_time_limit = $8, quiz_attempt_limit = $9,
            pdf_drive_link = $10
        WHERE id = $11
    `, [
        mod.title, mod.description || null, moduleData(mod),
        isLive(mod), isFree(mod), mod.serial, mod.score || 0,
        mod.quiz_time_limit || null, mod.quiz_attempt_limit || null, modulePdfLink(mod),
        moduleId,
    ]);
}

// How each import mode finds or creates the course: { courseId } or { error }.
const IMPORT_COURSE_MODES = {
    create: async (client, course) => {
        const existing = await client.query(`SELECT id FROM course WHERE title = $1`, [course.title]);
        if (existing.rows.length > 0) {
            return { error: `Course with title "${course.title}" already exists` };
        }
        const courseId = await insertImportedCourse(client, course);
        return courseId ? { courseId } : { error: 'Failed to create course' };
    },
    update: async (client, course) => {
        const courseId = await findImportedCourseId(client, course);
        if (!courseId) return { error: 'Course not found for update' };
        await updateImportedCourse(client, course, courseId);
        return { courseId };
    },
    upsert: async (client, course) => {
        const existingId = await findImportedCourseId(client, course);
        if (!existingId) return { courseId: await insertImportedCourse(client, course) };
        await updateImportedCourse(client, course, existingId);
        return { courseId: existingId };
    },
};

// Writes the whole import on the transaction client. update/upsert match existing chapters
// and modules by serial and update them; anything unmatched is inserted.
async function writeImport(client, courseData, importMode) {
    const { courseId, error } = await IMPORT_COURSE_MODES[importMode](client, courseData.course);
    if (error) return { success: false, error };

    const matchExisting = importMode === 'update' || importMode === 'upsert';
    let chaptersCreated = 0;
    let modulesCreated = 0;

    for (const chapterData of courseData.chapters) {
        if (!chapterData) continue;

        let chapterId = matchExisting ? await findChapterId(client, courseId, chapterData.serial) : null;
        if (chapterId) {
            await updateImportedChapter(client, chapterData, chapterId);
        } else {
            chapterId = await insertImportedChapter(client, courseId, chapterData);
            chaptersCreated++;
        }

        for (const mod of Array.isArray(chapterData.modules) ? chapterData.modules : []) {
            if (!mod) continue;

            const moduleId = matchExisting ? await findModuleId(client, chapterId, mod.serial) : null;
            if (moduleId) {
                await updateImportedModule(client, mod, moduleId);
            } else {
                await insertImportedModule(client, chapterId, mod);
                modulesCreated++;
            }
        }
    }

    return { success: true, courseId, chaptersCreated, modulesCreated };
}

// Validate-only result: chapter and module counts, modules per category.
function importValidationSummary(courseData) {
    const summary = {
        total_chapters: courseData.chapters.length,
        total_modules: courseData.chapters.reduce((sum, ch) => sum + (ch.modules?.length || 0), 0),
        modules_by_type: {}
    };
    for (const ch of courseData.chapters) {
        for (const mod of Array.isArray(ch.modules) ? ch.modules : []) {
            if (mod && mod.category) {
                summary.modules_by_type[mod.category] = (summary.modules_by_type[mod.category] || 0) + 1;
            }
        }
    }
    return summary;
}

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
                    logger.error('Error in async import processing:', error);
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
            logger.error('Error starting import:', error);
            return {
                success: false,
                error: 'Failed to start import',
                code: 'IMPORT_START_FAILED'
            };
        }
    }

    /**
     * Process import (async): parse, validate, then either record a validation summary or
     * write the course in one transaction. Every outcome lands on the import tracking row.
     * @private
     */
    async processImport(uploadKey, format, importMode, createdBy, importId, validateOnly) {
        const fail = (errors) => this.updateImportTracking(importId, { status: 'failed', errors });
        try {
            const parsed = await this.parseImportFile(uploadKey, format);
            if (parsed.errors) return await fail(parsed.errors);

            const courseData = parsed.data;
            const validationErrors = this.importValidationErrors(courseData);
            if (validationErrors) return await fail(validationErrors);

            if (validateOnly) {
                return await this.updateImportTracking(importId, {
                    status: 'completed',
                    summary: importValidationSummary(courseData)
                });
            }

            const outcome = await this.withTransaction((client) => writeImport(client, courseData, importMode));
            if (!outcome.success) return await fail([{ error: outcome.error }]);

            const { courseId } = outcome;
            await this.updateImportTracking(importId, {
                status: 'completed',
                course_id: courseId,
                summary: {
                    // CURRENT BEHAVIOUR: courseId is always set here, so an upsert never reports
                    // "created" and its course_updated is the id (pinned in courseImport.test.js).
                    course_created: importMode === 'create' || (importMode === 'upsert' && !courseId),
                    course_updated: importMode === 'update' || (importMode === 'upsert' && courseId),
                    chapters_created: outcome.chaptersCreated,
                    modules_created: outcome.modulesCreated
                }
            });
        } catch (error) {
            logger.error('Error processing import:', error);
            await fail([{ error: error.message }]);
        }
    }

    // The uploaded file as course data: { data } or { errors } for the tracking row.
    async parseImportFile(uploadKey, format) {
        const fileContent = await presignedUploadService.getObjectText(uploadKey);
        const parse = { json: this.parseJSONFile, csv: this.parseCSVFile }[format];
        if (!parse) return { errors: [{ error: `Unsupported format: ${format}` }] };
        const parseResult = await parse.call(this, fileContent);
        return parseResult.success ? { data: parseResult.data } : { errors: [{ error: parseResult.error }] };
    }

    // Strict validation, one level at a time: the course (first error), then every chapter,
    // then every module. Returns the tracking-row errors, or null when the data is valid.
    importValidationErrors(courseData) {
        const courseValidation = this.validateCourseData(courseData.course);
        if (!courseValidation.valid) {
            return [{ type: 'course', error: courseValidation.errors }];
        }
        if (!courseData.chapters || !Array.isArray(courseData.chapters)) {
            return [{ type: 'chapters', error: 'Chapters array is required' }];
        }

        const chapterErrors = {};
        courseData.chapters.forEach((chapter, i) => {
            if (!chapter) {
                chapterErrors[`chapter_${i}`] = 'Chapter is null or undefined';
                return;
            }
            Object.assign(chapterErrors, this.validateChapterData(chapter, i).errors);
        });
        if (Object.keys(chapterErrors).length > 0) {
            return [{ type: 'chapters', error: chapterErrors }];
        }

        const moduleErrors = {};
        courseData.chapters.forEach((chapter, i) => {
            if (!Array.isArray(chapter.modules)) return;
            chapter.modules.forEach((module, j) => {
                if (!module) {
                    moduleErrors[`chapter_${i}_module_${j}`] = 'Module is null or undefined';
                    return;
                }
                Object.assign(moduleErrors, this.validateModuleData(module, i, j).errors);
            });
        });
        if (Object.keys(moduleErrors).length > 0) {
            return [{ type: 'modules', error: moduleErrors }];
        }
        return null;
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
            logger.error('Error exporting course:', error);
            return {
                success: false,
                error: 'Failed to export course',
                code: 'EXPORT_FAILED'
            };
        }
    }
}

module.exports = { CourseImportExportService };
