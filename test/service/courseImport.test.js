// Course JSON import (Admin: /v2/admin/course import): what create / update / upsert write
// to course, chapter and module, and what the import tracking row reports.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { ADMIN, seed, pool } = require('../helpers/fixtures');
const presignedUploadService = require('../../util/presignedUploadService');
const { CourseImportExportService } = require('../../service/managerial/courseImportExport');

const service = new CourseImportExportService();
const uploads = {};
const realGetObjectText = presignedUploadService.getObjectText;

before(async () => {
    await seed();
    // The shared seed inserts fixed ids without advancing the sequences.
    await pool.query(`SELECT setval('course_id_seq', 10000), setval('chapter_id_seq', 10000), setval('module_id_seq', 10000)`);
    presignedUploadService.getObjectText = async (key) => uploads[key];
});

after(async () => {
    presignedUploadService.getObjectText = realGetObjectText;
    await pool.end();
});

// Runs one import of `content` (synchronously, via processImport) and returns the tracking row.
let n = 0;
const runRawImport = async (mode, content, { format = 'json', validateOnly = false } = {}) => {
    const key = `import-${++n}.${format}`;
    uploads[key] = content;
    const tracking = await service.createImportTracking(format, mode, ADMIN.id);
    const importId = tracking.data.import_id;
    await service.processImport(key, format, mode, ADMIN.id, importId, validateOnly);
    const row = (await pool.query(
        'SELECT status, course_id, summary, errors FROM course_import_tracking WHERE import_id = $1', [importId]
    )).rows[0];
    return row;
};
const runImport = (mode, data, options) => runRawImport(mode, JSON.stringify(data), options);

const courseState = async (courseId) => {
    const course = (await pool.query(
        `SELECT title, description, language, price, x_price, short_description, intro_video, url, enrolled, is_live
         FROM course WHERE id = $1`, [courseId]
    )).rows[0];
    const chapters = (await pool.query(
        'SELECT id, serial, title, is_free, is_live FROM chapter WHERE course_id = $1 ORDER BY serial', [courseId]
    )).rows;
    for (const ch of chapters) {
        ch.modules = (await pool.query(
            `SELECT serial, title, description, data, is_live, is_free, score, quiz_time_limit, quiz_attempt_limit, pdf_drive_link
             FROM module WHERE chapter_id = $1 ORDER BY serial`, [ch.id]
        )).rows;
        delete ch.id;
    }
    return { course, chapters };
};

const base = {
    course: { title: 'Imported Course', description: 'D', price: 500, x_price: 700, url: 'imported-course' },
    chapters: [
        {
            serial: 1, title: 'Intro', is_free: true,
            modules: [
                { serial: 1, title: 'Welcome', category: 'TEXT', score: 5 },
                { serial: 2, title: 'Notes', category: 'PDF', data: { category: 'PDF', pdf_drive_link: 'https://drive/x' } },
            ],
        },
        { serial: 2, title: 'Second', modules: [{ serial: 1, title: 'Quiz', category: 'QUIZ', quiz_time_limit: 10, quiz_attempt_limit: 2 }] },
    ],
};

let courseId;

test('create: writes the course, chapters and modules with defaults', async () => {
    const row = await runImport('create', base);
    assert.strictEqual(row.status, 'completed', JSON.stringify(row.errors));
    courseId = row.course_id;
    assert.deepStrictEqual(row.summary, { course_created: true, course_updated: false, chapters_created: 2, modules_created: 3 });

    assert.deepStrictEqual(await courseState(courseId), {
        course: {
            title: 'Imported Course', description: 'D', language: 'English', price: 500, x_price: 700,
            short_description: null, intro_video: null, url: 'imported-course', enrolled: 0, is_live: true,
        },
        chapters: [
            {
                serial: 1, title: 'Intro', is_free: true, is_live: true,
                modules: [
                    { serial: 1, title: 'Welcome', description: null, data: { category: 'TEXT' }, is_live: true, is_free: false, score: 5, quiz_time_limit: null, quiz_attempt_limit: null, pdf_drive_link: null },
                    { serial: 2, title: 'Notes', description: null, data: { category: 'PDF', pdf_drive_link: 'https://drive/x' }, is_live: true, is_free: false, score: 0, quiz_time_limit: null, quiz_attempt_limit: null, pdf_drive_link: 'https://drive/x' },
                ],
            },
            {
                serial: 2, title: 'Second', is_free: false, is_live: true,
                modules: [
                    { serial: 1, title: 'Quiz', description: null, data: { category: 'QUIZ' }, is_live: true, is_free: false, score: 0, quiz_time_limit: 10, quiz_attempt_limit: 2, pdf_drive_link: null },
                ],
            },
        ],
    });
});

test('create: a second course with the same title fails and writes nothing', async () => {
    const row = await runImport('create', base);
    assert.strictEqual(row.status, 'failed');
    assert.deepStrictEqual(row.errors, [{ error: 'Course with title "Imported Course" already exists' }]);
    const count = await pool.query("SELECT count(*)::int AS n FROM course WHERE title = 'Imported Course'");
    assert.strictEqual(count.rows[0].n, 1);
});

test('update: matches chapters/modules by serial, updates them and adds new ones', async () => {
    const data = structuredClone(base);
    data.course.price = 450;
    data.course.is_live = false;
    data.chapters[0].title = 'Intro (edited)';
    data.chapters[0].modules[0] = { serial: 1, title: 'Welcome v2', category: 'VIDEO', score: 1, description: 'new' };
    data.chapters.push({ serial: 3, title: 'Third', is_live: false, modules: [{ serial: 1, title: 'Extra', category: 'TEXT' }] });

    const row = await runImport('update', data);
    assert.strictEqual(row.status, 'completed', JSON.stringify(row.errors));
    assert.strictEqual(row.course_id, courseId);
    assert.deepStrictEqual(row.summary, { course_created: false, course_updated: true, chapters_created: 1, modules_created: 1 });

    const state = await courseState(courseId);
    assert.deepStrictEqual([state.course.price, state.course.is_live], [450, false]);
    assert.deepStrictEqual(state.chapters.map((c) => [c.serial, c.title, c.is_live, c.modules.length]), [
        [1, 'Intro (edited)', true, 2], [2, 'Second', true, 1], [3, 'Third', false, 1],
    ]);
    assert.deepStrictEqual(state.chapters[0].modules[0], {
        serial: 1, title: 'Welcome v2', description: 'new', data: { category: 'VIDEO' }, is_live: true, is_free: false,
        score: 1, quiz_time_limit: null, quiz_attempt_limit: null, pdf_drive_link: null,
    });
});

test('update: an unknown course fails', async () => {
    const data = structuredClone(base);
    data.course.title = 'No Such Course';
    const row = await runImport('update', data);
    assert.strictEqual(row.status, 'failed');
    assert.deepStrictEqual(row.errors, [{ error: 'Course not found for update' }]);
});

test('upsert: creates a missing course, then updates it in place', async () => {
    const data = structuredClone(base);
    data.course.title = 'Upserted Course';
    const created = await runImport('upsert', data);
    assert.strictEqual(created.status, 'completed', JSON.stringify(created.errors));
    // CURRENT BEHAVIOUR: for upsert the summary is computed from courseId, which is always set by
    // then, so it never says "created" and `course_updated` is the course id, not a boolean.
    assert.deepStrictEqual(created.summary, { course_created: false, course_updated: created.course_id, chapters_created: 2, modules_created: 3 });

    data.course.description = 'changed';
    data.chapters[1].modules.push({ serial: 2, title: 'Quiz 2', category: 'QUIZ' });
    const updated = await runImport('upsert', data);
    assert.strictEqual(updated.course_id, created.course_id);
    assert.deepStrictEqual(updated.summary, { course_created: false, course_updated: created.course_id, chapters_created: 0, modules_created: 1 });
    const state = await courseState(created.course_id);
    assert.strictEqual(state.course.description, 'changed');
    assert.deepStrictEqual(state.chapters[1].modules.map((m) => m.title), ['Quiz', 'Quiz 2']);
});

// ---------- failures and validate-only (nothing is written) ----------

const courseCount = async () => (await pool.query('SELECT count(*)::int AS n FROM course')).rows[0].n;
const failedWith = async (row, errors) => {
    assert.strictEqual(row.status, 'failed');
    assert.deepStrictEqual(row.errors, errors);
    assert.strictEqual(row.course_id, null);
};

test('unsupported format and unparsable files', async () => {
    const before = await courseCount();
    await failedWith(await runRawImport('create', '{}', { format: 'xml' }), [{ error: 'Unsupported format: xml' }]);
    const broken = await runRawImport('create', '{not json');
    assert.strictEqual(broken.status, 'failed');
    assert.match(broken.errors[0].error, /^Failed to parse JSON file: /);
    await failedWith(await runRawImport('create', '{"chapters": []}'), [{ error: 'Invalid JSON format: missing course object' }]);
    await failedWith(await runRawImport('create', '{"course": {"title": "x"}}'), [{ error: 'Invalid JSON format: missing chapters array' }]);
    assert.strictEqual(await courseCount(), before);
});

test('course, chapter and module validation stop the import', async () => {
    const before = await courseCount();
    const data = (patch) => {
        const d = structuredClone(base);
        d.course.title = 'Never Written';
        patch(d);
        return d;
    };
    await failedWith(await runImport('create', data((d) => { d.course.title = ' '; })),
        [{ type: 'course', error: { title: 'Course title is required' } }]);
    await failedWith(await runImport('create', data((d) => { d.course.price = -1; })),
        [{ type: 'course', error: { price: 'Price must be a non-negative number' } }]);

    // every chapter is checked and the errors collected; null chapters are reported too
    await failedWith(await runImport('create', data((d) => {
        d.chapters[0].serial = 0;
        d.chapters[1].is_live = 'yes';
        d.chapters.push(null);
    })), [{
        type: 'chapters',
        error: {
            'chapters[0].serial': 'Chapter serial must be a positive integer',
            'chapters[1].is_live': 'is_live must be a boolean',
            chapter_2: 'Chapter is null or undefined',
        },
    }]);

    // modules are only checked once the chapters pass
    await failedWith(await runImport('create', data((d) => {
        d.chapters[0].modules[0].category = 'AUDIO';
        d.chapters[0].modules.push(null);
        d.chapters[1].modules[0].data = { quiz: 'not-a-list' };
    })), [{
        type: 'modules',
        error: {
            'chapters[0].modules[0].category': 'Category must be one of: VIDEO, QUIZ, PDF, TEXT',
            chapter_0_module_2: 'Module is null or undefined',
            'chapters[1].modules[0].data.quiz': 'Quiz must be an array',
        },
    }]);
    assert.strictEqual(await courseCount(), before);
});

test('validate-only reports a summary and writes nothing', async () => {
    const before = await courseCount();
    const data = structuredClone(base);
    data.course.title = 'Only Validated';
    data.chapters.push({ serial: 3, title: 'No modules' });
    const row = await runImport('create', data, { validateOnly: true });
    assert.strictEqual(row.status, 'completed');
    assert.strictEqual(row.course_id, null);
    assert.deepStrictEqual(row.summary, { total_chapters: 3, total_modules: 3, modules_by_type: { TEXT: 1, PDF: 1, QUIZ: 1 } });
    assert.strictEqual(await courseCount(), before);
});

test('a database error inside the import rolls back and is recorded', async () => {
    const before = await courseCount();
    const data = structuredClone(base);
    data.course.title = 'Rolled Back';
    data.chapters[0].modules[0].serial = 2 ** 31; // out of range for an integer column
    const row = await runImport('create', data);
    assert.strictEqual(row.status, 'failed');
    assert.strictEqual(row.errors.length, 1);
    assert.strictEqual(typeof row.errors[0].error, 'string');
    assert.strictEqual(await courseCount(), before);
});
