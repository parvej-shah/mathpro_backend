const test = require('node:test');
const assert = require('node:assert/strict');
const { byKey, byPaymentType } = require('../../util/itemTypes');
const CouponService = require('../../service/managerial/coupon');

test('item registry: lookups by key and by payment type', () => {
  assert.equal(byKey('bundle').linkTable, 'coupon_bundles');
  assert.equal(byPaymentType('BOOK').key, 'book');
  assert.equal(byKey('constructor'), null);
  assert.equal(byKey('nope'), null);
});

test('coupon getItemConfig is unchanged for course, bundle and book', () => {
  const svc = new CouponService();
  assert.deepEqual(svc.getItemConfig('course'), { itemLabel: 'course', itemKey: 'course_id', linkTable: 'coupon_courses', linkKey: 'course_id', itemTable: 'course' });
  assert.deepEqual(svc.getItemConfig('bundle'), { itemLabel: 'bundle', itemKey: 'bundle_id', linkTable: 'coupon_bundles', linkKey: 'bundle_id', itemTable: 'bundle' });
  assert.deepEqual(svc.getItemConfig('book'), { itemLabel: 'book', itemKey: 'book_id', linkTable: 'coupon_books', linkKey: 'book_id', itemTable: 'book' });
  assert.equal(svc.getItemConfig('x'), null);
});
