// Records the SQL and params every date-range-filtered list/report sends, for each mix of
// bounds, and compares them with test/service/__snapshots__/dateFilters.json. Pins the
// shared dateRangeFilter (phase R, R7). Regenerate with UPDATE_SNAPSHOTS=1 after an
// intentional change and review the diff.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { CouponAnalyticsService } = require('../../service/managerial/coupon/analytics');
const { CouponClickTrackingService } = require('../../service/managerial/coupon/clickTracking');
const { CouponCrudService } = require('../../service/managerial/coupon/crud');
const { FeedbackService } = require('../../service/feedback');
const { UserService } = require('../../service/managerial/user');
const { UserAnalyticsService } = require('../../service/managerial/analyticsV2/parts/users');

const SNAPSHOT = path.join(__dirname, '__snapshots__', 'dateFilters.json');
const FROM = 1700000000;
const TO = 1800000000;
const ROW = { total: 3, count: 3, total_clicks: 1, total_conversions: 1, total_usage: 1, unique_users: 1, total_discount: 1, total_revenue: 1 };

const bounds = {
  both: (from, to) => ({ from, to }),
  fromOnly: (from) => ({ from }),
  toOnly: (from, to) => ({ to }),
  none: () => ({}),
};

// name -> (service factory, call(svc, {from, to}))
const cases = {
  'coupon.getAllCouponStats': [() => new CouponAnalyticsService(), (s, r) => s.getAllCouponStats({ dateFrom: r.from && String(r.from), dateTo: r.to && String(r.to) })],
  'coupon.getCouponUsageStatistics': [() => new CouponAnalyticsService(), (s, r) => s.getCouponUsageStatistics({ startDate: r.from, endDate: r.to })],
  'coupon.getRevenueImpactAnalytics': [() => new CouponAnalyticsService(), (s, r) => s.getRevenueImpactAnalytics({ startDate: r.from, endDate: r.to })],
  'coupon.getTopPerformingCoupons': [() => new CouponAnalyticsService(), (s, r) => s.getTopPerformingCoupons({ startDate: r.from, endDate: r.to })],
  'coupon.getCouponUsageReport': [() => new CouponAnalyticsService(), (s, r) => s.getCouponUsageReport(5, { startDate: r.from, endDate: r.to })],
  'clicks.getCouponClicks': [() => new CouponClickTrackingService(), (s, r) => s.getCouponClicks(5, { dateFrom: r.from && String(r.from), dateTo: r.to && String(r.to) })],
  'clicks.getAllCouponClicks': [() => new CouponClickTrackingService(), (s, r) => s.getAllCouponClicks({ dateFrom: r.from && String(r.from), dateTo: r.to && String(r.to) })],
  'clicks.getCouponConversionStats': [() => new CouponClickTrackingService(), (s, r) => s.getCouponConversionStats(5, { dateFrom: r.from && String(r.from), dateTo: r.to && String(r.to) })],
  'clicks.getCouponClickAnalytics': [() => new CouponClickTrackingService(), (s, r) => s.getCouponClickAnalytics(5, { dateFrom: r.from && String(r.from), dateTo: r.to && String(r.to) })],
  'crud.listCoupons': [() => new CouponCrudService(), (s, r) => s.listCoupons({ startDate: r.from, endDate: r.to }, { page: 1, limit: 10 })],
  'feedback.exportFeedbacks': [() => new FeedbackService(), (s, r) => s.exportFeedbacks({ startDate: r.from, endDate: r.to })],
  'user.listUsers': [() => new UserService(), (s, r) => s.listUsers({ dateFrom: r.from, dateTo: r.to }, { page: 1, limit: 10 })],
  'analytics.getLearningProgress': [() => new UserAnalyticsService(), (s, r) => s.getLearningProgress({ startDate: r.from, endDate: r.to }, { hasGlobalAccess: true })],
};

async function record() {
  const out = {};
  const realNow = Date.now;
  Date.now = () => 1750000000000; // methods that default a window off "now" stay deterministic
  try {
    for (const [name, [make, call]] of Object.entries(cases)) {
      for (const [label, pick] of Object.entries(bounds)) {
        const svc = make();
        const calls = [];
        svc.query = async (sql, params = []) => {
          calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
          return { success: true, data: [ROW] };
        };
        await call(svc, pick(FROM, TO));
        out[`${name} [${label}]`] = calls;
      }
    }
  } finally {
    Date.now = realNow;
  }
  return out;
}

test('date-range filters: SQL and params match the snapshot', async () => {
  const actual = JSON.parse(JSON.stringify(await record())); // as stored: undefined params become null
  if (process.env.UPDATE_SNAPSHOTS || !fs.existsSync(SNAPSHOT)) {
    fs.writeFileSync(SNAPSHOT, JSON.stringify(actual, null, 1) + '\n');
  }
  const expected = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  for (const key of Object.keys(expected)) assert.deepEqual(actual[key], expected[key], key);
  assert.deepEqual(Object.keys(actual), Object.keys(expected));
  // Every case actually exercised its date filter.
  for (const name of Object.keys(cases)) {
    const both = JSON.stringify(actual[`${name} [both]`]);
    assert.ok(both.includes(String(FROM)) && both.includes(String(TO)), `${name} never bound the dates`);
  }
});
