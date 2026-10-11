// Featured items are courses or bundles only. Pins which table getItem reads and that every
// other type (books included) is refused, so the item-type registry can drive them (R4).
const test = require('node:test');
const assert = require('node:assert/strict');
const { FeaturedItemService } = require('../../service/managerial/featuredItem');

function svc() {
  const s = new FeaturedItemService();
  const calls = [];
  s.query = async (sql, params) => { calls.push([sql.replace(/\s+/g, ' ').trim(), params]); return { success: true, data: [{ id: params[0] }] }; };
  return { s, calls };
}

test('getItem reads the course or bundle table; anything else is an empty result without a query', async () => {
  const { s, calls } = svc();
  await s.getItem('course', 4);
  await s.getItem('bundle', 5);
  assert.deepEqual(calls, [
    ['SELECT id, title, is_live FROM course WHERE id = $1', [4]],
    ['SELECT id, title, is_live FROM bundle WHERE id = $1', [5]],
  ]);
  for (const other of ['book', 'COURSE', 'constructor', undefined]) {
    assert.deepEqual(await s.getItem(other, 1), { success: true, data: [] }, String(other));
  }
  assert.equal(calls.length, 2);
});

test('create and reorder refuse types other than course and bundle', async () => {
  const { s, calls } = svc();
  for (const item_type of ['book', 'BUNDLE', 'toString']) {
    assert.deepEqual(await s.create({ item_type, item_id: 1 }), { success: false, error: "item_type must be 'course' or 'bundle'" });
  }
  assert.equal(calls.length, 0);
  s.withTransaction = async (fn) => fn({ query: async () => ({ rows: [] }) });
  const r = await s.reorder([{ item_type: 'book', item_id: 1, sort_order: 1 }]);
  assert.equal(r.success, false);
  const ok = await s.reorder([{ item_type: 'bundle', item_id: 1, sort_order: 1 }]);
  assert.equal(ok.success, true);
});
