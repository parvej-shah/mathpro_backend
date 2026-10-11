const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePagination } = require('../../util/pagination');

test('parsePagination: defaults when absent', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 10, offset: 0 });
});

test('parsePagination: reads strings and computes offset', () => {
  assert.deepEqual(parsePagination({ page: '3', limit: '20' }), { page: 3, limit: 20, offset: 40 });
});

test('parsePagination: zero and junk fall back to defaults', () => {
  assert.deepEqual(parsePagination({ page: '0', limit: 'abc' }, { defaultLimit: 15 }), { page: 1, limit: 15, offset: 0 });
});

test('parsePagination: limit is capped', () => {
  assert.equal(parsePagination({ limit: '500' }, { maxLimit: 50 }).limit, 50);
});
