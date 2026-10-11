// Pins the SQL and params of updateReason / updateRole, which build their SET list with buildUpdate.
const test = require('node:test');
const assert = require('node:assert/strict');
const { RoleService } = require('../../service/managerial/roleService');
const mf = require('../../service/moduleFeedback');

const ModuleFeedbackService = mf.ModuleFeedbackService || mf.default || Object.values(mf).find((v) => typeof v === 'function');

function captured(svc, rows) {
  const calls = [];
  svc.query = async (sql, params) => { calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params }); return { success: true, data: rows }; };
  return calls;
}

test('updateReason: sets only supplied fields, id is the last param', async () => {
  const svc = new ModuleFeedbackService();
  const calls = captured(svc, [{ id: 5 }]);
  const r = await svc.updateReason(5, { reason_label: 'L', is_active: false });
  assert.equal(r.success, true);
  assert.equal(calls[0].sql, 'UPDATE module_feedback_reasons SET reason_label = $1, is_active = $2 WHERE id = $3 RETURNING *');
  assert.deepEqual(calls[0].params, ['L', false, 5]);
});

test('updateReason: nothing supplied is refused without a query', async () => {
  const svc = new ModuleFeedbackService();
  const calls = captured(svc, []);
  assert.deepEqual(await svc.updateReason(5, {}), { success: false, error: 'No fields to update' });
  assert.equal(calls.length, 0);
});

test('updateRole: permissions are JSON-encoded and the id is the last param', async () => {
  const svc = new RoleService();
  svc.getRoleById = async () => ({ success: true, data: { name: 'custom' } });
  const calls = captured(svc, [{ id: 9 }]);
  await svc.updateRole(9, { display_name: 'D', description: null });
  assert.equal(calls[0].sql, 'UPDATE roles SET display_name = $1, description = $2 WHERE id = $3 RETURNING id, name, display_name, description, permissions, updated_at');
  assert.deepEqual(calls[0].params, ['D', null, 9]);
});

test('updateRole: nothing supplied is refused', async () => {
  const svc = new RoleService();
  svc.getRoleById = async () => ({ success: true, data: { name: 'custom' } });
  assert.deepEqual(await svc.updateRole(9, {}), { success: false, error: 'No fields to update' });
});
