// integrations/sslcommerz.js: which SSLCommerz host each call goes to.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const sslcommerz = require('../../integrations/sslcommerz');
const sslcommerzStub = require('../helpers/sslcommerzStub');

let gw;
const original = process.env.SSLCOMMERZ_LIVE;

before(() => {
    gw = sslcommerzStub.install();
});

after(() => {
    gw.restore();
    if (original === undefined) delete process.env.SSLCOMMERZ_LIVE;
    else process.env.SSLCOMMERZ_LIVE = original;
});

const hostsFor = async (live) => {
    if (live === undefined) delete process.env.SSLCOMMERZ_LIVE;
    else process.env.SSLCOMMERZ_LIVE = live;
    gw.hosts.length = 0;
    await sslcommerz.initSession({ tran_id: 'T1', total_amount: '10.00' });
    await sslcommerz.validateTransaction('T1');
    await sslcommerz.validateOrder('V1');
    return [sslcommerz.isLive(), ...gw.hosts];
};

test('every call goes to the live host unless SSLCOMMERZ_LIVE=false', async () => {
    const paths = ['/gwprocess/v4/api.php', '/validator/api/merchantTransIDvalidationAPI.php', '/validator/api/validationserverAPI.php'];
    for (const live of [undefined, 'true']) {
        assert.deepStrictEqual(await hostsFor(live), [true, ...paths.map((p) => `securepay.sslcommerz.com${p}`)], String(live));
    }
    assert.deepStrictEqual(await hostsFor('false'), [false, ...paths.map((p) => `sandbox.sslcommerz.com${p}`)]);
});

test('validateTransaction / validateOrder need an id to look up', async () => {
    assert.deepStrictEqual(await sslcommerz.validateTransaction(null), {
        success: false, error: 'Either tran_id, val_id, or sessionkey must be provided',
    });
    assert.deepStrictEqual(await sslcommerz.validateOrder(undefined), { success: false, error: 'No val_id' });
});
