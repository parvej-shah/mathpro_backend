// What the three purchasable item types have in common, written once.
// `key` is the lowercase name used by coupons and featured items; `paymentType` is the
// uppercase value stored in payment_audit_log.item_type and sent in SSLCommerz value_b.
const ITEM_TYPES = {
  course: { key: 'course', paymentType: 'COURSE', itemTable: 'course', linkTable: 'coupon_courses', idColumn: 'course_id' },
  bundle: { key: 'bundle', paymentType: 'BUNDLE', itemTable: 'bundle', linkTable: 'coupon_bundles', idColumn: 'bundle_id' },
  book: { key: 'book', paymentType: 'BOOK', itemTable: 'book', linkTable: 'coupon_books', idColumn: 'book_id' },
};

const byKey = (key) => (Object.prototype.hasOwnProperty.call(ITEM_TYPES, key) ? ITEM_TYPES[key] : null);
const byPaymentType = (paymentType) =>
  Object.values(ITEM_TYPES).find((t) => t.paymentType === paymentType) || null;

module.exports = { ITEM_TYPES, byKey, byPaymentType };
