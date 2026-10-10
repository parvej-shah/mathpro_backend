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
    return [sslcommerz.isLive(), ...gw.hosts];
};

test('live / sandbox host per SSLCOMMERZ_LIVE', async () => {
    // CURRENT BEHAVIOUR: session init and validation go to opposite environments
    // (sslcommerz-lts's 3rd argument means `live`, it is passed the sandbox flag).
    for (const live of [undefined, 'true']) {
        assert.deepStrictEqual(await hostsFor(live), [
            true,
            'sandbox.sslcommerz.com/gwprocess/v4/api.php',
            'securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php',
        ], String(live));
    }
    assert.deepStrictEqual(await hostsFor('false'), [
        false,
        'securepay.sslcommerz.com/gwprocess/v4/api.php',
        'sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php',
    ]);
});

test('validateTransaction needs an id to look up', async () => {
    assert.deepStrictEqual(await sslcommerz.validateTransaction(null), {
        success: false, error: 'Either tran_id, val_id, or sessionkey must be provided',
    });
});
