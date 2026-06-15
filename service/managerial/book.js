const Service = require('../base').Service;

/**
 * BookService — admin catalogue of (physical) books, the many-to-many link to
 * courses (course_book), the helpers that resolve a course's/bundle's attached
 * books (reused by the payment flow), and the admin fulfilment views over
 * course_book_purchase.
 */
class BookService extends Service {
    constructor() {
        super();
    }

    table = `book`;
    pk = `id`;
    cols = [
        `title`,
        `image_url`,
        `description`,
        `class_levels`,
        `tags`,
        `price`,
        `is_active`
    ];
    // JSON columns that must be stringified before binding
    jsonCols = [`class_levels`, `tags`];

    normalizeColumnValue = (column, value) => {
        if (!this.jsonCols.includes(column) || value === undefined || value === null) {
            return value;
        }
        if (typeof value === 'string') return value;
        return JSON.stringify(value);
    };

    // ---- CRUD ----------------------------------------------------------------

    list = async () => {
        var query = `select * from ${this.table} order by id desc`;
        return this.query(query, []);
    };

    get = async (id) => {
        var query = `select * from ${this.table} where ${this.pk} = $1`;
        return this.query(query, [id]);
    };

    create = async (reqObj, createdBy = null) => {
        const now = parseInt(Date.now() / 1000);
        const columns = [...this.cols, `created_by`, `created_at`, `updated_at`];
        const wildcards = columns.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            insert into ${this.table}(${columns.join(',')}) values (${wildcards}) returning *
        `;
        const params = [
            ...this.cols.map((c) => this.normalizeColumnValue(c, reqObj[c])),
            createdBy,
            now,
            now
        ];
        return this.query(query, params);
    };

    update = async (id, reqObj) => {
        const now = parseInt(Date.now() / 1000);
        const pairs = this.cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
        // updated_at uses the next slot, id the one after that
        const query = `
            update ${this.table} set ${pairs}, updated_at = $${this.cols.length + 1}
            where ${this.pk} = $${this.cols.length + 2} returning *
        `;
        const params = [
            ...this.cols.map((c) => this.normalizeColumnValue(c, reqObj[c])),
            now,
            id
        ];
        return this.query(query, params);
    };

    deleteEntry = async (id) => {
        var query = `delete from ${this.table} where ${this.pk} = $1`;
        return this.query(query, [id]);
    };

    // ---- course_book link ----------------------------------------------------

    listForCourse = async (courseId) => {
        var query = `
            select b.* from course_book cb
            join book b on b.id = cb.book_id
            where cb.course_id = $1
            order by b.id desc
        `;
        return this.query(query, [courseId]);
    };

    attach = async (courseId, bookId) => {
        var query = `
            insert into course_book(course_id, book_id) values ($1, $2)
            on conflict (course_id, book_id) do nothing
        `;
        return this.query(query, [courseId, bookId]);
    };

    detach = async (courseId, bookId) => {
        var query = `delete from course_book where course_id = $1 and book_id = $2`;
        return this.query(query, [courseId, bookId]);
    };

    // ---- selection resolution (reused by payment) ----------------------------
    // Returns the active books a student would get when including books for a
    // course or a bundle. For a bundle this is the DISTINCT union of the books
    // attached to every course in the bundle.

    booksForCourse = async (courseId) => {
        var query = `
            select b.id, b.title, b.image_url, b.price, b.class_levels, b.tags, b.description
            from course_book cb
            join book b on b.id = cb.book_id
            where cb.course_id = $1 and b.is_active = true
        `;
        return this.query(query, [courseId]);
    };

    booksForBundle = async (bundleId) => {
        var query = `
            select distinct on (b.id) b.id, b.title, b.image_url, b.price, b.class_levels, b.tags, b.description
            from bundle_course bc
            join course_book cb on cb.course_id = bc.course_id
            join book b on b.id = cb.book_id
            where bc.bundle_id = $1 and b.is_active = true
            order by b.id
        `;
        return this.query(query, [bundleId]);
    };

    // For a bundle book purchase, find one bundle course the book is attached to
    // (used as course_id on the purchase row for grouping/fulfilment).
    courseForBundleBook = async (bundleId, bookId) => {
        var query = `
            select bc.course_id from bundle_course bc
            join course_book cb on cb.course_id = bc.course_id
            where bc.bundle_id = $1 and cb.book_id = $2
            limit 1
        `;
        return this.query(query, [bundleId, bookId]);
    };

    // ---- admin fulfilment (course_book_purchase) -----------------------------

    listOrders = async (status = null) => {
        var query = `
            select cbp.*, b.title as book_title, b.image_url as book_image_url,
                   a.name as user_name, a.login as user_login
            from course_book_purchase cbp
            join book b on b.id = cbp.book_id
            left join managerial_auth a on a.id = cbp.user_id
        `;
        var params = [];
        if (status) {
            query += ` where cbp.fulfillment_status = $1`;
            params = [status];
        }
        query += ` order by cbp.timestamp desc nulls last, cbp.id desc`;
        return this.query(query, params);
    };

    updateOrderStatus = async (id, status) => {
        var query = `update course_book_purchase set fulfillment_status = $1 where id = $2 returning *`;
        return this.query(query, [status, id]);
    };
}

module.exports = { BookService };
