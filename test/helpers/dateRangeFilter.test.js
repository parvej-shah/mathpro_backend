const test = require('node:test');
const assert = require('node:assert/strict');
const { dateRangeFilter } = require('../../util/dateRangeFilter');

test('dateRangeFilter: both, one or no bounds, numbered from startIndex', () => {
  assert.deepEqual(dateRangeFilter('t.ts', 10, 20), { conditions: ['t.ts >= $1', 't.ts <= $2'], params: [10, 20], nextIndex: 3 });
  assert.deepEqual(dateRangeFilter('t.ts', null, 20, { startIndex: 4 }), { conditions: ['t.ts <= $4'], params: [20], nextIndex: 5 });
  assert.deepEqual(dateRangeFilter('t.ts', 10, undefined, { startIndex: 2 }), { conditions: ['t.ts >= $2'], params: [10], nextIndex: 3 });
  assert.deepEqual(dateRangeFilter('t.ts', 0, ''), { conditions: [], params: [], nextIndex: 1 });
});

test('dateRangeFilter: transform applies to each bound', () => {
  assert.deepEqual(dateRangeFilter('c', '10', '20', { transform: (v) => parseInt(v) }).params, [10, 20]);
});
