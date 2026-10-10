// Which courses / bundles a coupon applies to (Admin coupon editor). Every reply of
// add/remove, for both item types, pinned before the two copies became one.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { seed, pool } = require('../helpers/fixtures');
const CouponService = require('../../service/managerial/coupon');

const coupons = new CouponService();

before(async () => {
    await seed();
    await pool.query(`
        INSERT INTO course (id, title, price, x_price, is_live, "isActive", serial, slug, url, tags, is_free) VALUES
            (871, 'T1', 1, 1, true, true, 871, 't-871', 't-871', '[]', false),
            (872, 'T2', 1, 1, true, true, 872, 't-872', 't-872', '[]', false);
        INSERT INTO bundle (id, title, price, is_live, is_active) VALUES (871, 'TB1', 1, true, true), (872, 'TB2', 1, true, true);
        INSERT INTO coupons (id, name, code, discount_type, discount_value, start_time, end_time, created_at, updated_at, status) VALUES
            (871, 'T', 'TARGET871', 'fixed', 1, 1, 2000000000, 1, 1, 'active'),
            (872, 'Gone', 'TARGET872', 'fixed', 1, 1, 2000000000, 1, 1, 'deleted');
    `);
});

after(async () => {
    await pool.end();
});

const strip = (result) => {
    const copy = structuredClone(result);
    for (const key of ['addedCourses', 'addedBundles', 'removedCourses', 'removedBundles']) {
        if (copy.data && copy.data[key]) copy.data[key] = copy.data[key].map((row) => Object.keys(row).sort().join(','));
    }
    return copy;
};

for (const [noun, Plural, add, remove] of [
    ['course', 'Courses', 'addCoursesToCoupon', 'removeCoursesFromCoupon'],
    ['bundle', 'Bundles', 'addBundlesToCoupon', 'removeBundlesFromCoupon'],
]) {
    test(`${noun}s: add / remove replies`, async () => {
        const required = { success: false, error: `Coupon ID and ${noun} IDs array are required` };
        assert.deepStrictEqual(await coupons[add](871, []), required);
        assert.deepStrictEqual(await coupons[add](null, [871]), required);
        assert.deepStrictEqual(await coupons[remove](871, 'x'), required);
        assert.deepStrictEqual(await coupons[add](872, [871]), { success: false, error: 'Coupon not found' });
        assert.deepStrictEqual(await coupons[remove](99999, [871]), { success: false, error: 'Coupon not found' });
        assert.deepStrictEqual(await coupons[add](871, [871, 99998, 99999]), { success: false, error: `Invalid ${noun} IDs: 99998, 99999` });

        assert.deepStrictEqual(strip(await coupons[add](871, [871])), {
            success: true, message: `Successfully associated 1 ${noun}s with coupon`,
            data: { addedCount: 1, existingCount: 0, [`added${Plural}`]: [`${noun}_id,id`] },
        });
        assert.deepStrictEqual(strip(await coupons[add](871, ['871', 872])), {
            success: true, message: `Successfully associated 1 ${noun}s with coupon`,
            data: { addedCount: 1, existingCount: 1, [`added${Plural}`]: [`${noun}_id,id`] },
        });
        assert.deepStrictEqual(await coupons[add](871, [871, 872]), {
            success: true, message: `All ${noun}s are already associated with this coupon`,
            data: { addedCount: 0, existingCount: 2 },
        });

        assert.deepStrictEqual(strip(await coupons[remove](871, [872, 99999])), {
            success: true, message: `Successfully removed 1 ${noun} associations`,
            data: { removedCount: 1, [`removed${Plural}`]: [`${noun}_id,id`] },
        });
        const left = await pool.query(`SELECT ${noun}_id AS id FROM coupon_${noun}s WHERE coupon_id = 871`);
        assert.deepStrictEqual(left.rows, [{ id: 871 }]);
    });
}
