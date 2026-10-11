// Pins the SQL and params of the remaining dynamic UPDATE builders (phase R, R1), so moving
// them onto util/buildUpdate cannot change what reaches the database.
const test = require('node:test');
const assert = require('node:assert/strict');

function captured(svc, responder) {
  const calls = [];
  svc.query = async (sql, params) => {
    const call = { sql: sql.replace(/\s+/g, ' ').trim(), params };
    calls.push(call);
    return responder ? responder(call, calls.length) : { success: true, data: [{ id: 1 }] };
  };
  return calls;
}

const NOW = 1_800_000_000;
function withFrozenClock(fn) {
  const real = Date.now;
  Date.now = () => NOW * 1000;
  return Promise.resolve().then(fn).finally(() => { Date.now = real; });
}

// --- feedback.updateFeedback -------------------------------------------------------------
const { FeedbackService } = require('../../service/feedback');

function feedbackSvc(ownerId = 7) {
  const svc = new FeedbackService();
  const calls = captured(svc, (call) => (call.sql.startsWith('SELECT')
    ? { success: true, data: [{ user_id: ownerId }] }
    : { success: true, data: [] }));
  return { svc, calls };
}

test('updateFeedback: rating, comment and category in that order, id last', async () => {
  const { svc, calls } = feedbackSvc();
  const r = await svc.updateFeedback(3, 7, { category: 'c', comment: null, rating: 4 });
  assert.deepEqual(r, { success: true, message: 'Feedback updated successfully' });
  assert.equal(calls[1].sql, 'UPDATE feedbacks SET rating = $1, comment = $2, category = $3 WHERE id = $4');
  assert.deepEqual(calls[1].params, [4, null, 'c', 3]);
});

test('updateFeedback: one field, an out-of-range rating, and an empty patch', async () => {
  let { svc, calls } = feedbackSvc();
  await svc.updateFeedback(3, 7, { comment: 'x' });
  assert.equal(calls[1].sql, 'UPDATE feedbacks SET comment = $1 WHERE id = $2');
  assert.deepEqual(calls[1].params, ['x', 3]);

  ({ svc, calls } = feedbackSvc());
  assert.deepEqual(await svc.updateFeedback(3, 7, { rating: 6, comment: 'x' }), { success: false, error: 'Invalid rating value' });
  assert.equal(calls.length, 1);

  ({ svc, calls } = feedbackSvc());
  assert.deepEqual(await svc.updateFeedback(3, 7, { other: 1 }), { success: false, error: 'No fields to update' });
  assert.equal(calls.length, 1);
});

test('updateFeedback: another user\'s feedback is refused before any update', async () => {
  const { svc, calls } = feedbackSvc(8);
  assert.deepEqual(await svc.updateFeedback(3, 7, { rating: 4 }), { success: false, error: 'Unauthorized to update this feedback' });
  assert.equal(calls.length, 1);
});

// --- coupon crud.updateCoupon ------------------------------------------------------------
const { CouponCrudService } = require('../../service/managerial/coupon/crud');
const CouponAuditLogger = require('../../service/managerial/CouponAuditLogger');

function couponSvc() {
  const svc = new CouponCrudService();
  const calls = captured(svc, (call) => (call.sql.startsWith('SELECT')
    ? { success: true, data: [{ id: 4, usage_count: 2 }] }
    : { success: true, data: [{ id: 4 }] }));
  return { svc, calls };
}

test('updateCoupon: camelCase input maps to columns, metadata is JSON, updated_at then id last', async (t) => {
  t.mock.method(CouponAuditLogger, 'logCouponUpdate', () => {});
  await withFrozenClock(async () => {
    const { svc, calls } = couponSvc();
    const r = await svc.updateCoupon(4, {
      metadata: { a: 1 }, status: 'inactive', usageLimit: 10, discountValue: 5, discountType: 'fixed', description: 'd', name: 'Coupon',
    });
    assert.equal(r.success, true);
    assert.equal(calls[1].sql, 'UPDATE coupons SET name = $1, description = $2, discount_type = $3, discount_value = $4, usage_limit = $5, status = $6, metadata = $7, updated_at = $8 WHERE id = $9 RETURNING *');
    assert.deepEqual(calls[1].params, ['Coupon', 'd', 'fixed', 5, 10, 'inactive', '{"a":1}', NOW, 4]);
  });
});

test('updateCoupon: snake_case input and a null usage limit', async (t) => {
  t.mock.method(CouponAuditLogger, 'logCouponUpdate', () => {});
  await withFrozenClock(async () => {
    const { svc, calls } = couponSvc();
    await svc.updateCoupon(4, { usage_limit: null, discount_value: 10, discount_type: 'percentage' });
    assert.equal(calls[1].sql, 'UPDATE coupons SET discount_type = $1, discount_value = $2, usage_limit = $3, updated_at = $4 WHERE id = $5 RETURNING *');
    assert.deepEqual(calls[1].params, ['percentage', 10, null, NOW, 4]);
  });
});

test('updateCoupon: nothing valid to update is refused without an UPDATE', async () => {
  const { svc, calls } = couponSvc();
  assert.deepEqual(await svc.updateCoupon(4, {}), { success: false, error: 'No valid fields to update' });
  assert.equal(calls.filter((c) => c.sql.startsWith('UPDATE')).length, 0);
});

// --- courseV2.updateImportTracking -------------------------------------------------------
const { CourseServiceV2 } = require('../../service/managerial/courseV2');

test('updateImportTracking: JSON columns are encoded, a terminal status stamps completed_at', async () => {
  const svc = new CourseServiceV2();
  const calls = captured(svc, () => ({ success: true, data: [{ import_id: 'i1', status: 'completed' }] }));
  const r = await svc.updateImportTracking('i1', {
    progress: { p: 1 }, warnings: ['w'], errors: [], summary: { s: 2 }, course_id: 9, status: 'completed',
  });
  assert.deepEqual(r, { success: true, data: { import_id: 'i1', status: 'completed' } });
  assert.equal(calls[0].sql, 'UPDATE course_import_tracking SET status = $1, course_id = $2, summary = $3, errors = $4, warnings = $5, progress = $6, completed_at = NOW() WHERE import_id = $7 RETURNING import_id, status');
  assert.deepEqual(calls[0].params, ['completed', 9, '{"s":2}', '[]', '["w"]', '{"p":1}', 'i1']);
});

test('updateImportTracking: a running status does not stamp completed_at; empty patch skips the query', async () => {
  const svc = new CourseServiceV2();
  const calls = captured(svc, () => ({ success: true, data: [{}] }));
  await svc.updateImportTracking('i1', { status: 'processing', progress: null });
  assert.equal(calls[0].sql, 'UPDATE course_import_tracking SET status = $1, progress = $2 WHERE import_id = $3 RETURNING import_id, status');
  assert.deepEqual(calls[0].params, ['processing', 'null', 'i1']);

  assert.deepEqual(await svc.updateImportTracking('i1', {}), { success: true });
  assert.equal(calls.length, 1);
});

test('updateImportTracking: completed_at alone when only a terminal status would be set', async () => {
  const svc = new CourseServiceV2();
  const calls = captured(svc, () => ({ success: true, data: [{}] }));
  await svc.updateImportTracking('i1', { status: 'failed' });
  assert.equal(calls[0].sql, 'UPDATE course_import_tracking SET status = $1, completed_at = NOW() WHERE import_id = $2 RETURNING import_id, status');
});

// --- payment.updatePaymentLog ------------------------------------------------------------
const { PaymentService } = require('../../service/user/payment');

test('updatePaymentLog: supplied columns, processing_result as JSON, processed_at always, id last', async () => {
  await withFrozenClock(async () => {
    const svc = new PaymentService();
    const calls = captured(svc);
    await svc.updatePaymentLog(11, { retry_count: 2, processing_result: { ok: true }, error_message: null, processing_status: 'done' });
    assert.equal(calls[0].sql, 'UPDATE payment_audit_log SET processing_status = $1, error_message = $2, processing_result = $3, retry_count = $4, processed_at = $5 WHERE id = $6 RETURNING *');
    assert.deepEqual(calls[0].params, ['done', null, '{"ok":true}', 2, NOW, 11]);

    await svc.updatePaymentLog(11, {});
    assert.equal(calls[1].sql, 'UPDATE payment_audit_log SET processed_at = $1 WHERE id = $2 RETURNING *');
    assert.deepEqual(calls[1].params, [NOW, 11]);
  });
});

// --- moduleV2.importQuiz / updateEnhanced ------------------------------------------------
const { ModuleServiceV2 } = require('../../service/managerial/moduleV2');

function moduleSvc(moduleRow) {
  const svc = new ModuleServiceV2();
  svc.get = async () => ({ success: true, data: [moduleRow] });
  const calls = captured(svc, () => ({ success: true, data: [{ id: 2, title: 'T2' }] }));
  return { svc, calls };
}

test('importQuiz: data first, then time and attempt limits from metadata, id last', async () => {
  const { svc, calls } = moduleSvc({ id: 2, data: { category: 'QUIZ' } });
  const quiz = [{ question: 'q', options: ['a', 'b'] }];
  const r = await svc.importQuiz(2, { quiz, metadata: { attempt_limit: 3, time_limit: 0 } });
  assert.equal(r.success, true);
  assert.equal(calls[0].sql, 'UPDATE module SET data = $1, quiz_time_limit = $2, quiz_attempt_limit = $3 WHERE id = $4 RETURNING id');
  assert.equal(JSON.parse(calls[0].params[0]).quiz.length, 1);
  assert.deepEqual(calls[0].params.slice(1), [0, 3, 2]);

  const again = moduleSvc({ id: 2, data: { category: 'QUIZ' } });
  await again.svc.importQuiz(2, { quiz });
  assert.equal(again.calls[0].sql, 'UPDATE module SET data = $1 WHERE id = $2 RETURNING id');
  assert.equal(again.calls[0].params[1], 2);
});

test('updateEnhanced (module): column order, JSON data, pdf link from data, id last', async () => {
  const { svc, calls } = moduleSvc({ id: 2, title: 'T' });
  const r = await svc.updateEnhanced(2, {
    data: { pdf_drive_link: 'https://cdn.test/a.pdf' }, live_scheduled_at: 5, live_meeting_pass: 'p', live_meeting_id: 'm',
    live_status: null, quiz_attempt_limit: 1, quiz_time_limit: 9, serial: 4, is_free: false, is_live: true, score: 10, description: 'd', title: 'New',
  });
  assert.deepEqual(r, { success: true, data: { id: 2, title: 'T2', message: 'Module updated successfully' } });
  assert.equal(calls[0].sql, 'UPDATE module SET title = $1, description = $2, score = $3, is_live = $4, is_free = $5, serial = $6, quiz_time_limit = $7, quiz_attempt_limit = $8, live_status = $9, live_meeting_id = $10, live_meeting_pass = $11, live_scheduled_at = $12, data = $13, pdf_drive_link = $14 WHERE id = $15 RETURNING id, title');
  assert.deepEqual(calls[0].params, ['New', 'd', 10, true, false, 4, 9, 1, null, 'm', 'p', 5, '{"pdf_drive_link":"https://cdn.test/a.pdf"}', 'https://cdn.test/a.pdf', 2]);
});

test('updateEnhanced (module): null and string data, top-level pdf link wins, validation and empty patch', async () => {
  let { svc, calls } = moduleSvc({ id: 2, title: 'T' });
  await svc.updateEnhanced(2, { data: null, pdf_drive_link: null });
  assert.equal(calls[0].sql, 'UPDATE module SET data = $1, pdf_drive_link = $2 WHERE id = $3 RETURNING id, title');
  assert.deepEqual(calls[0].params, [null, null, 2]);

  ({ svc, calls } = moduleSvc({ id: 2, title: 'T' }));
  await svc.updateEnhanced(2, { data: '{"x":1}', pdf_drive_link: 'https://cdn.test/top.pdf' });
  assert.deepEqual(calls[0].params, ['{"x":1}', 'https://cdn.test/top.pdf', 2]);

  ({ svc, calls } = moduleSvc({ id: 2, title: 'T' }));
  const bad = await svc.updateEnhanced(2, { title: 'x', live_status: 'NOPE' });
  assert.equal(bad.code, 'VALIDATION_ERROR');
  assert.deepEqual(Object.keys(bad.details), ['live_status']);
  assert.equal(calls.length, 0);

  ({ svc, calls } = moduleSvc({ id: 2, title: 'T' }));
  const badPdf = await svc.updateEnhanced(2, { title: 'x', pdf_drive_link: 'https://drive.google.com/nope' });
  assert.equal(badPdf.code, 'VALIDATION_ERROR');
  assert.deepEqual(Object.keys(badPdf.details), ['pdf_drive_link']);
  assert.equal(calls.length, 0);

  ({ svc, calls } = moduleSvc({ id: 2, title: 'T' }));
  const empty = await svc.updateEnhanced(2, { unknown: 1 });
  assert.equal(empty.error, 'No fields to update');
  assert.equal(calls.length, 0);
});

// --- teacherV2.updateEnhanced ------------------------------------------------------------
const { TeacherServiceV2 } = require('../../service/managerial/teacherV2');

function teacherSvc(existing, { loginTaken = false } = {}) {
  const svc = new TeacherServiceV2();
  const calls = captured(svc, (call) => {
    if (call.sql.startsWith('SELECT id, type, profile')) return { success: true, data: [existing] };
    if (call.sql.startsWith('SELECT id FROM managerial_auth WHERE login')) return { success: true, data: loginTaken ? [{ id: 99 }] : [] };
    return { success: true, data: [{ id: existing.id, name: 'n', login: 'l', type: 3 }] };
  });
  return { svc, calls };
}

const updatesOf = (calls) => calls.filter((c) => c.sql.startsWith('UPDATE'));

test('updateEnhanced (teacher): name, login, email synced from an email login, merged profile, id last', async () => {
  const { svc, calls } = teacherSvc({ id: 5, type: 3, profile: { bio: 'old', extra: 1 }, name: 'A', login: 'old@x.com', email: 'old@x.com', phone: null });
  const r = await svc.updateEnhanced(5, { name: 'B', login: 'new@x.com', bio: 'new' });
  assert.equal(r.success, true);
  const [u] = updatesOf(calls);
  assert.equal(u.sql, 'UPDATE managerial_auth SET name = $1, login = $2, email = $3, profile = $4 WHERE id = $5 RETURNING id, name, login, type');
  assert.deepEqual(u.params.slice(0, 3), ['B', 'new@x.com', 'new@x.com']);
  assert.deepEqual(JSON.parse(u.params[3]), { bio: 'new', extra: 1, category: 'instructor', isActive: true });
  assert.equal(u.params[4], 5);
});

test('updateEnhanced (teacher): phone synced from a phone login when missing; profile-only update', async () => {
  let { svc, calls } = teacherSvc({ id: 5, type: 3, profile: null, name: 'A', login: '01700000000', email: null, phone: '' });
  await svc.updateEnhanced(5, {});
  let [u] = updatesOf(calls);
  assert.equal(u.sql, 'UPDATE managerial_auth SET phone = $1, profile = $2 WHERE id = $3 RETURNING id, name, login, type');
  assert.equal(u.params[0], '01700000000');

  ({ svc, calls } = teacherSvc({ id: 5, type: 3, profile: {}, name: 'A', login: 'a@x.com', email: 'a@x.com', phone: null }));
  await svc.updateEnhanced(5, { email: 'ignored-col' });
  [u] = updatesOf(calls);
  assert.equal(u.sql, 'UPDATE managerial_auth SET profile = $1 WHERE id = $2 RETURNING id, name, login, type');
});

test('updateEnhanced (teacher): taken login is refused; revoking access sets the regular type', async () => {
  let { svc, calls } = teacherSvc({ id: 5, type: 3, profile: {}, name: 'A', login: 'a@x.com', email: 'a@x.com', phone: null }, { loginTaken: true });
  const r = await svc.updateEnhanced(5, { login: 'b@x.com' });
  assert.deepEqual(r.details, { login: 'Login already exists' });
  assert.equal(updatesOf(calls).length, 0);

  ({ svc, calls } = teacherSvc({ id: 5, type: 1, profile: {}, name: 'A', login: 'a@x.com', email: 'a@x.com', phone: null }));
  await svc.updateEnhanced(5, { isPrivileged: false });
  const [u] = updatesOf(calls);
  assert.equal(u.sql, 'UPDATE managerial_auth SET type = $1, profile = $2 WHERE id = $3 RETURNING id, name, login, type');
  assert.equal(u.params[0], 3);
});

// --- user.updateUser ---------------------------------------------------------------------
const { UserService } = require('../../service/managerial/user');

function userSvc(current, { taken = false } = {}) {
  const svc = new UserService();
  svc.getUserDetails = async () => ({ success: true, data: current });
  const calls = captured(svc, (call) => (call.sql.startsWith('SELECT')
    ? { success: true, data: taken ? [{ id: 99 }] : [] }
    : { success: true, data: [{ id: current.id }] }));
  return { svc, calls };
}

test('updateUser: name, email, phone, profile, login, updated_at; id and type last', async () => {
  const { svc, calls } = userSvc({ id: 8, email: 'a@x.com', phone: null, login: 'a@x.com' });
  const r = await svc.updateUser(8, { profile: '{"p":1}', phone: '01711111111', email: 'b@x.com', name: 'N' }, 1);
  assert.equal(r.success, true);
  const [u] = updatesOf(calls);
  assert.equal(u.sql, 'UPDATE managerial_auth SET name = $1, email = $2, phone = $3, profile = $4, login = $5, updated_at = NOW() WHERE id = $6 AND type = $7 RETURNING id, name, type, login, email, phone, profile, created_at, updated_at');
  assert.deepEqual(u.params, ['N', 'b@x.com', '01711111111', { p: 1 }, 'b@x.com', 8, 3]);
});

test('updateUser: clearing the phone writes NULL; unchanged login is not rewritten', async () => {
  const { svc, calls } = userSvc({ id: 8, email: 'a@x.com', phone: '01711111111', login: 'a@x.com' });
  await svc.updateUser(8, { phone: '' }, 1);
  const [u] = updatesOf(calls);
  assert.equal(u.sql, 'UPDATE managerial_auth SET phone = $1, updated_at = NOW() WHERE id = $2 AND type = $3 RETURNING id, name, type, login, email, phone, profile, created_at, updated_at');
  assert.deepEqual(u.params, [null, 8, 3]);
});

test('updateUser: nothing to change, and a taken email, are refused without an UPDATE', async () => {
  let { svc, calls } = userSvc({ id: 8, email: 'a@x.com', phone: null, login: 'a@x.com' });
  assert.deepEqual(await svc.updateUser(8, {}, 1), { success: false, error: 'No fields to update' });
  assert.equal(updatesOf(calls).length, 0);

  ({ svc, calls } = userSvc({ id: 8, email: 'a@x.com', phone: null, login: 'a@x.com' }, { taken: true }));
  assert.deepEqual(await svc.updateUser(8, { email: 'b@x.com' }, 1), { success: false, error: 'Email already exists' });
  assert.equal(updatesOf(calls).length, 0);
});

// --- testimonial.update (feedback-side columns) ------------------------------------------
const { TestimonialService } = require('../../service/managerial/testimonial');

test('testimonial update: supplied feedback columns trimmed (blank -> null) in map order, id last', async () => {
  const svc = new TestimonialService();
  svc.getFeedbackWithCourse = async () => ({ success: true, data: [{ course_id: 1 }] });
  svc.hasCourseAccess = () => true;
  const calls = captured(svc, () => ({ success: true, data: [] }));
  const r = await svc.update(6, { hook_text: '  h ', institution_name: '   ', comment: ' c ' }, {});
  assert.deepEqual(r, { success: true, data: [{ feedback_id: 6 }] });
  assert.equal(calls[0].sql, 'UPDATE feedbacks SET comment = $1, institution_name = $2, hook_text = $3 WHERE id = $4');
  assert.deepEqual(calls[0].params, ['c', null, 'h', 6]);
  assert.equal(calls.length, 1);
});
