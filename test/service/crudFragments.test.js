// Pins the INSERT/UPDATE fragments the table-backed services build from `cols` (and `fk`),
// whitespace-insensitive, so pulling them up into CrudService (phase R, R3) can't change SQL.
const test = require('node:test');
const assert = require('node:assert/strict');

const services = {
  announcement: require('../../service/managerial/announcement').AnnouncementService,
  chapter: require('../../service/managerial/chapter').ChapterService,
  course: require('../../service/managerial/course').CourseService,
  courseV2: require('../../service/managerial/courseV2').CourseServiceV2,
  module: require('../../service/managerial/module').ModuleService,
  moduleV2: require('../../service/managerial/moduleV2').ModuleServiceV2,
  routine: require('../../service/managerial/routine').RoutineService,
  teacher: require('../../service/managerial/teacher').TeacherService,
  teacherV2: require('../../service/managerial/teacherV2').TeacherServiceV2,
};

const COURSE_COLS = 'title,x_price,price,is_free,language,enrolled,you_get,chips,short_description,instructor_list,faq_list,description,feedback_list,intro_video,is_live,serial,url,slug,total_seats,tags,course_outline';
const params = (n) => `(${Array.from({ length: n }, (_, i) => `$${i + 1}`).join(',')})`;
const pairs = (cols) => cols.split(',').map((c, i) => `${c}=$${i + 1}`).join(',');

const expected = {
  announcement: ['user_type,subject,description,sent_methods,email_is_sent,sms_is_sent,notification_is_sent,created_at', 'course_id'],
  chapter: ['title,chips_list,is_free,is_live,serial', 'course_id'],
  course: [COURSE_COLS, null],
  courseV2: [COURSE_COLS, null],
  module: ['title,description,metadata,data,is_live,is_free,serial,score', 'chapter_id'],
  moduleV2: ['title,description,metadata,data,is_live,is_free,serial,score', 'chapter_id'],
  routine: ['week_number,routine_image_url,week_start_date,week_end_date,is_active', 'course_id'],
  teacher: ['name,type,login,profile', null],
  teacherV2: ['name,type,login,profile', null],
};

const squash = (s) => String(s).replace(/\s+/g, '');

for (const [name, [cols, fk]] of Object.entries(expected)) {
  test(`${name}: INSERT columns/placeholders (fk last) and UPDATE pairs`, () => {
    const svc = new services[name]();
    if (!svc.getColumns) svc.getColumns = svc.getColumnsWithParenthesis; // announcement's old name
    const insertCols = fk ? `${cols},${fk}` : cols;
    assert.equal(squash(svc.getColumns()), `(${insertCols})`);
    assert.equal(squash(svc.getWildCards()), params(insertCols.split(',').length));
    assert.equal(squash(svc.getUpdatePairs()), pairs(cols));
  });
}

test('deleteEntry: announcement deletes by id with no RETURNING; courseV2 keeps its own', async () => {
  const svc = new services.announcement();
  const calls = [];
  svc.query = async (sql, p) => { calls.push([squash(sql), p]); return { success: true, data: [] }; };
  await svc.deleteEntry(4);
  assert.deepEqual(calls[0][1], [4]);
  assert.equal(calls[0][0].toLowerCase(), 'deletefromannouncementswhereid=$1');

  assert.equal(services.courseV2.prototype.deleteEntry.length, 1);
  const v2 = new services.courseV2();
  assert.equal(v2.deleteEntry, services.courseV2.prototype.deleteEntry);
});

const { BookService } = require('../../service/managerial/book');

test('get by primary key: one SELECT * on the service table', async () => {
  const cases = [
    [new services.chapter(), 'get', 'chapter'],
    [new services.course(), 'get', 'course'],
    [new services.courseV2(), 'get', 'course'],
    [new services.teacher(), 'get', 'managerial_auth'],
    [new BookService(), 'get', 'book'],
    [new services.announcement(), 'getEntry', 'announcements'],
  ];
  for (const [svc, method, table] of cases) {
    const calls = [];
    svc.query = async (sql, p) => { calls.push([squash(sql).toLowerCase(), p]); return { success: true, data: [{ id: 3 }] }; };
    assert.deepEqual(await svc[method](3), { success: true, data: [{ id: 3 }] });
    assert.deepEqual(calls, [[`select*from${table}whereid=$1`, [3]]], `${table}.${method}`);
  }
});
