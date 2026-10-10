// Fake SSLCommerz at the network boundary (Node's https.request), so payment code is
// exercised unchanged: sslcommerz-lts reaches it via node-fetch for `init`, and
// integrations/sslcommerz.js validateTransaction calls https.request directly.
// Every other host falls through to the real https.request (which test/setup.js blocks).
//
//   const gw = sslcommerzStub.install();
//   gw.inits                       // form fields of every session-init POST, in order
//   gw.hosts                       // 'host/path' of every SSLCommerz call, in order
//   gw.setValidation(tranId, {...}) // element[0] the tran_id query returns for tranId; its
//                                  // val_id (default `VAL-<tranId>`) answers the val_id API
//                                  // with the value_a..d sent at init for that tranId, and
//                                  // after a VALID answer the transaction reads VALIDATED
//   gw.initReply = 'text'          // next session-init answers with this raw body instead
//   gw.restore();
const https = require('https');
const { Writable, PassThrough } = require('stream');

const HOST = /(^|\.)sslcommerz\.com$/;

// sslcommerz-lts posts multipart/form-data; pull out the plain text fields.
function parseMultipart(body) {
    const fields = {};
    const re = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g;
    let m;
    while ((m = re.exec(body))) fields[m[1]] = m[2];
    return fields;
}

function install() {
    const original = https.request;
    const state = {
        inits: [],
        hosts: [],
        validationCalls: [],
        validations: new Map(),
        initReply: null,
        valIds: new Map(),
        orderCalls: [],
        setValidation(tranId, element) {
            const valId = element.val_id || `VAL-${tranId}`;
            state.validations.set(tranId, { ...element, val_id: valId });
            state.valIds.set(valId, tranId);
        },
        restore() {
            https.request = original;
        },
    };

    const answer = (path, body) => {
        const url = new URL(path, 'https://sslcommerz.test');
        if (url.pathname === '/gwprocess/v4/api.php') {
            const fields = parseMultipart(body);
            state.inits.push(fields);
            if (state.initReply !== null) {
                const reply = state.initReply;
                state.initReply = null;
                return reply;
            }
            return {
                status: 'SUCCESS',
                sessionkey: `SESSION-${fields.tran_id}`,
                GatewayPageURL: `https://sandbox.sslcommerz.com/EasyCheckOut/test-${fields.tran_id}`,
            };
        }
        if (url.pathname === '/validator/api/merchantTransIDvalidationAPI.php') {
            const tranId = url.searchParams.get('tran_id');
            state.validationCalls.push(tranId);
            const element = state.validations.get(tranId);
            return element
                ? { APIConnect: 'DONE', no_of_trans_found: 1, element: [{ tran_id: tranId, ...element }] }
                : { APIConnect: 'DONE', no_of_trans_found: 0, element: [] };
        }
        if (url.pathname === '/validator/api/validationserverAPI.php') {
            const valId = url.searchParams.get('val_id');
            state.orderCalls.push(valId);
            const tranId = state.valIds.get(valId);
            const element = tranId && state.validations.get(tranId);
            if (!element) return { APIConnect: 'DONE', status: 'INVALID_TRANSACTION' };
            const init = [...state.inits].reverse().find((f) => f.tran_id === tranId) || {};
            const reply = {
                APIConnect: 'DONE', ...element, tran_id: tranId, val_id: valId,
                value_a: init.value_a || '', value_b: init.value_b || '', value_c: init.value_c || '', value_d: init.value_d || '',
            };
            if (element.status === 'VALID') state.validations.set(tranId, { ...element, status: 'VALIDATED' });
            return reply;
        }
        return { status: 'FAILED', failedreason: `stub: unknown path ${url.pathname}` };
    };

    https.request = function stubbedRequest(...args) {
        // Both callers pass an options object; anything else isn't SSLCommerz traffic.
        const options = args[0];
        const hostname = (options && typeof options === 'object' && (options.hostname || options.host)) || '';
        if (!HOST.test(hostname)) return original.apply(https, args);
        state.hosts.push(`${hostname}${new URL(options.path || '/', 'https://x').pathname}`);
        const callback = args.find((a) => typeof a === 'function');

        const chunks = [];
        const req = new Writable({
            write(chunk, _enc, done) {
                chunks.push(Buffer.from(chunk));
                done();
            },
        });
        req.setTimeout = () => req;
        req.abort = () => {};
        req.on('finish', () => {
            const payload = answer(options.path || '/', Buffer.concat(chunks).toString('utf8'));
            const res = new PassThrough();
            res.statusCode = 200;
            res.statusMessage = 'OK';
            res.headers = { 'content-type': 'application/json' };
            res.rawHeaders = ['Content-Type', 'application/json'];
            if (callback) callback(res);
            req.emit('response', res);
            res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
        });
        return req;
    };

    return state;
}

module.exports = { install };
