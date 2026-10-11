const test = require('node:test');
const assert = require('node:assert/strict');
const { toLimit, toOffset, parsePagination, parseLimitOffset, pageMeta } = require('../../util/pagination');
const { validateLimit, validateOffset } = require('../../util/analyticsV2/queryUtils');

test('parsePagination: defaults when absent', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 10, offset: 0 });
});

test('parsePagination: reads strings and computes offset', () => {
  assert.deepEqual(parsePagination({ page: '3', limit: '20' }), { page: 3, limit: 20, offset: 40 });
  assert.deepEqual(parsePagination({ page: 2, limit: 5 }), { page: 2, limit: 5, offset: 5 });
});

test('parsePagination: zero, negative and junk fall back to defaults', () => {
  assert.deepEqual(parsePagination({ page: '0', limit: 'abc' }, { defaultLimit: 15 }), { page: 1, limit: 15, offset: 0 });
  assert.deepEqual(parsePagination({ page: '-2', limit: '-1' }, { defaultPage: 1, defaultLimit: 20 }), { page: 1, limit: 20, offset: 0 });
});

test('parsePagination: limit is capped, page is not', () => {
  assert.equal(parsePagination({ limit: '500' }, { maxLimit: 50 }).limit, 50);
  assert.equal(parsePagination({ page: '500' }, { maxLimit: 50 }).page, 500);
});

test('parseLimitOffset: defaults, strings, negatives and the cap', () => {
  assert.deepEqual(parseLimitOffset({}), { limit: 10, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: '25', offset: '50' }), { limit: 25, offset: 50 });
  assert.deepEqual(parseLimitOffset({ limit: '0', offset: '-3' }, { defaultLimit: 20 }), { limit: 20, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: '1000' }, { defaultLimit: 20, maxLimit: 100 }), { limit: 100, offset: 0 });
});

test('analyticsV2 validateLimit/validateOffset are the same rules', () => {
  for (const v of [undefined, null, '', 'x', '0', '-4', '1', '7', 7, '100', '101', 1e6]) {
    assert.equal(validateLimit(v), toLimit(v, { defaultLimit: 20, maxLimit: 100 }), `limit ${v}`);
    assert.equal(validateLimit(v, 5, 10), toLimit(v, { defaultLimit: 5, maxLimit: 10 }), `limit ${v} (5, 10)`);
    assert.equal(validateOffset(v), toOffset(v), `offset ${v}`);
  }
});

test('pageMeta: numbers, ceil of total pages, zero total', () => {
  assert.deepEqual(pageMeta('2', '10', 25), { page: 2, limit: 10, total: 25, totalPages: 3 });
  assert.deepEqual(pageMeta(1, 20, 0), { page: 1, limit: 20, total: 0, totalPages: 0 });
});
