const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUpdate } = require('../../util/buildUpdate');

test('buildUpdate: only whitelisted columns are used, in whitelist order', () => {
  const r = buildUpdate(['name', 'description'], { description: 'd', name: 'n', evil: 'x; DROP TABLE t' });
  assert.equal(r.setSql, 'name = $1, description = $2');
  assert.deepEqual(r.params, ['n', 'd']);
  assert.equal(r.nextIndex, 3);
});

test('buildUpdate: undefined is skipped, null is written', () => {
  const r = buildUpdate(['a', 'b', 'c'], { a: undefined, b: null, c: 0 });
  assert.equal(r.setSql, 'b = $1, c = $2');
  assert.deepEqual(r.params, [null, 0]);
});

test('buildUpdate: empty patch gives empty SQL', () => {
  const r = buildUpdate(['a'], {});
  assert.equal(r.setSql, '');
  assert.deepEqual(r.params, []);
  assert.equal(r.nextIndex, 1);
});

test('buildUpdate: transforms and startIndex', () => {
  const r = buildUpdate(['permissions'], { permissions: ['x'] }, { transforms: { permissions: JSON.stringify }, startIndex: 3 });
  assert.equal(r.setSql, 'permissions = $3');
  assert.deepEqual(r.params, ['["x"]']);
  assert.equal(r.nextIndex, 4);
});

test('buildUpdate: inherited keys are ignored', () => {
  const patch = Object.create({ a: 1 });
  assert.equal(buildUpdate(['a'], patch).setSql, '');
});
