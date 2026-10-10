// CouponValidator create/update: the error list (in order) and sanitized data for the fields
// both share (usage limit, status, metadata).
const { test } = require('node:test');
const assert = require('node:assert');
const CouponValidator = require('../../service/managerial/CouponValidator');

test('usage limit: positive integer, capped, null = unlimited, both spellings', () => {
    for (const fn of ['validateCreate', 'validateUpdate']) {
        const v = (input) => CouponValidator[fn](input);
        assert.strictEqual(v({ usageLimit: '7' }).data.usageLimit, 7);
        assert.strictEqual(v({ usage_limit: 3 }).data.usageLimit, 3);
        assert.strictEqual(v({ usageLimit: null }).data.usageLimit, null);
        assert.ok(v({ usageLimit: 0 }).errors.includes('Usage limit must be a positive integer'));
        assert.ok(v({ usageLimit: 2000000 }).errors.includes('Usage limit cannot exceed 1,000,000'));
        assert.ok(!('usageLimit' in v({}).data));
    }
});

test('status and metadata are optional and validated', () => {
    for (const fn of ['validateCreate', 'validateUpdate']) {
        const v = (input) => CouponValidator[fn](input);
        assert.strictEqual(v({ status: 'expired' }).data.status, 'expired');
        assert.ok(v({ status: 'bogus' }).errors.includes('Status must be one of: active, inactive, expired'));
        assert.deepStrictEqual(v({ metadata: { a: 1 } }).data.metadata, { a: 1 });
    }
});

test('update with only an invalid usage limit and status reports both, in field order', () => {
    const result = CouponValidator.validateUpdate({ usageLimit: -1, status: 'nope' });
    assert.deepStrictEqual(result, {
        valid: false,
        errors: ['Usage limit must be a positive integer', 'Status must be one of: active, inactive, expired'],
        data: {},
    });
});
