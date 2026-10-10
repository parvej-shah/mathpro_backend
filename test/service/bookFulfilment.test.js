// PaymentService.fulfilBookSelection (called by the IPN): a staged book selection becomes
// course_book_purchase rows, all or none.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { seed, pool } = require('../helpers/fixtures');
const { PaymentService } = require('../../service/user/payment');

const service = new PaymentService();
const USER = 2;

before(async () => {
    await seed();
    const t = Math.floor(Date.now() / 1000);
    await pool.query(`INSERT INTO book (id, title, price, is_active, created_at, updated_at) VALUES
        (791, 'B1', 100, true, ${t}, ${t}), (792, 'B2', 150, true, ${t}, ${t})`);
});

after(async () => {
    await pool.end();
});

const stage = (tranId, bookIds) => pool.query(
    `INSERT INTO payment_book_selection (transaction_id, user_id, item_type, item_id, books_total, book_ids,
        ship_name, ship_phone, ship_address, created_at)
     VALUES ($1, $2, 'BOOK', $3, 0, $4, 'N', 'P', 'A', 1)`,
    [tranId, USER, bookIds[0], JSON.stringify(bookIds)]
);
const purchases = async (tranId) => (await pool.query(
    'SELECT book_id, amount_paid FROM course_book_purchase WHERE transaction_id = $1 ORDER BY book_id', [tranId]
)).rows;

test('records every staged book; a replay records nothing new', async () => {
    await stage('BF-OK', [791, 792]);
    assert.deepStrictEqual(await service.fulfilBookSelection('BF-OK'), { success: true, fulfilled: 2 });
    assert.deepStrictEqual(await purchases('BF-OK'), [{ book_id: 791, amount_paid: 100 }, { book_id: 792, amount_paid: 150 }]);
    assert.deepStrictEqual(await service.fulfilBookSelection('BF-OK'), { success: true, fulfilled: 0 });
});

test('nothing staged → nothing to do', async () => {
    assert.deepStrictEqual(await service.fulfilBookSelection('BF-NONE'), { success: true, data: [], fulfilled: 0 });
});

test('a failing insert rolls back the whole order and is reported', async () => {
    await stage('BF-BAD', [791, 999999]); // 999999 violates the book foreign key
    await assert.rejects(service.fulfilBookSelection('BF-BAD'), /foreign key/);
    assert.deepStrictEqual(await purchases('BF-BAD'), []);
});
