const Service = require('../base').Service;
const sslcommerz = require('../../integrations/sslcommerz');
const CouponService = require('../managerial/coupon');
const logger = require('../../util/logger');
const { buildUpdate } = require('../../util/buildUpdate');

const couponService = new CouponService();

// What differs between buying a course, a bundle and a standalone book (see initiateCheckout).
// couponTarget gives recordUsage's [courseId, bundleId, bookId]; label is for log lines.
const CHECKOUT_ITEMS = {
    COURSE: {
        method: 'initiatePayment',
        label: '',
        itemQuery: `select * from course where id = $1`,
        couponValidator: 'validateCoupon',
        couponTarget: (id) => [id, null, null],
        productName: 'Math Pro Course',
        standalone: false
    },
    BUNDLE: {
        method: 'initiatePaymentForBundle',
        label: 'bundle ',
        itemQuery: `select * from bundle where id = $1`,
        couponValidator: 'validateCouponForBundle',
        couponTarget: (id) => [null, id, null],
        productName: 'Math Pro Bundle',
        standalone: false
    },
    // A book bought on its own: must exist and be active, needs shipping, and is
    // itself the shipped item (no course/bundle enrolment).
    BOOK: {
        method: 'initiatePaymentForBook',
        label: 'book ',
        itemQuery: `select * from book where id = $1 and is_active = true`,
        couponValidator: 'validateCouponForBook',
        couponTarget: (id) => [null, null, id],
        productName: 'Math Pro Book',
        standalone: true
    }
};

const sumPaid = (rows) => rows.reduce((sum, row) => sum + (parseFloat(row.paid_amount) || 0), 0);

const COUPON_COLUMNS = [
    'coupon_id', 'coupon_id_detail', 'coupon_code', 'coupon_name', 'coupon_discount_type', 'coupon_discount_value',
    'coupon_discount_amount', 'coupon_original_price', 'coupon_final_price'
];
const numberOrNull = (value) => (value ? parseFloat(value) : null);

// A course/bundle history row as it appears in all_transactions: the coupon_* columns
// folded into one `coupon` object (or null).
function historyTransaction(row, transactionDate, itemType) {
    const transaction = { ...row, transaction_date: transactionDate, item_type: itemType };
    transaction.coupon = row.coupon_id_detail || row.coupon_code
        ? {
            id: row.coupon_id_detail,
            code: row.coupon_code,
            name: row.coupon_name,
            discount_type: row.coupon_discount_type,
            discount_value: row.coupon_discount_value,
            discount_amount: numberOrNull(row.coupon_discount_amount),
            original_price: numberOrNull(row.coupon_original_price),
            final_price: numberOrNull(row.coupon_final_price)
        }
        : null;
    for (const column of COUPON_COLUMNS) delete transaction[column];
    return transaction;
}

class PaymentService extends Service {
    constructor() {
        super();
    }

    getSafeUserProfile = (profile) => {
        if (!profile) return {};
        if (typeof profile === 'object' && !Array.isArray(profile)) return profile;
        if (typeof profile === 'string') {
            try {
                const parsed = JSON.parse(profile);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            } catch (error) {
                return {};
            }
        }
        return {};
    }

    getCustomerContactDetails = (user = {}) => {
        const profile = this.getSafeUserProfile(user.profile);
        return {
            name: user.name || 'Customer',
            email: user.email || profile.email || 'customer@gmail.com',
            phone: user.phone || profile.phone || user.login || ''
        };
    }

    buildGatewayAddressPayload = (user = {}, bookSelection = { include: false, shipping: null }) => {
        const customer = this.getCustomerContactDetails(user);
        const shipping = bookSelection?.include && bookSelection?.shipping
            ? bookSelection.shipping
            : null;

        const shippingName = shipping?.name || customer.name;
        const shippingPhone = shipping?.phone || customer.phone;
        const shippingAddress = shipping?.address || 'Dhaka';
        const shippingCity = shipping?.city || 'Dhaka';
        const shippingPostcode = shipping?.postcode || '1000';

        return {
            cus_name: customer.name,
            cus_email: customer.email,
            cus_add1: shippingAddress,
            cus_city: shippingCity,
            cus_state: shippingCity,
            cus_postcode: shippingPostcode,
            cus_country: 'Bangladesh',
            cus_phone: customer.phone,
            cus_fax: customer.phone,
            ship_name: shippingName,
            ship_add1: shippingAddress,
            ship_city: shippingCity,
            ship_state: shippingCity,
            ship_postcode: shippingPostcode,
            ship_country: 'Bangladesh'
        };
    }

    // Generate transaction ID (access code) - same format as used in IPN
    // Format: {random_chars}{user_id}{item_id} (max 20 chars, SSLCommerz supports up to 30)
    generateTransactionId = (userId, itemId) => {
        const idString = userId.toString() + itemId.toString();
        const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
        const remainingLength = 20 - idString.length;
        let uniqueString = '';
        for (let i = 0; i < remainingLength; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            uniqueString += characters[randomIndex];
        }
        uniqueString += idString;
        return uniqueString;
    }

    // Resolve the optional "include books" selection for a course/bundle purchase.
    // Returns { include, booksTotal, books, shipping }. When the student opted in
    // we read the attached books server-side (never trusting client prices) and
    // require a shipping address (books are physical goods).
    resolveBookSelection = async (body, itemType, itemId) => {
        if (!body || body.include_books !== true) {
            return { include: false, booksTotal: 0, books: [], shipping: null };
        }

        const BookService = require('../managerial/book').BookService;
        const bookService = new BookService();
        const booksResult = itemType === 'BUNDLE'
            ? await bookService.booksForBundle(itemId)
            : await bookService.booksForCourse(itemId);

        if (!booksResult.success) {
            return { error: 'Failed to resolve attached books' };
        }
        const books = booksResult.data || [];
        if (books.length === 0) {
            return { error: 'No books are available to include for this item' };
        }

        const s = body.shipping || {};
        if (!s.name || !s.phone || !s.address) {
            return { error: 'Shipping name, phone and address are required when including books' };
        }

        const booksTotal = books.reduce((sum, b) => sum + parseInt(b.price || 0), 0);
        return {
            include: true,
            booksTotal,
            books,
            shipping: {
                name: s.name,
                phone: s.phone,
                address: s.address,
                city: s.city || null,
                postcode: s.postcode || null
            }
        };
    }

    // Persist the book selection keyed by transaction_id so the IPN can fulfil it
    // after the redirect round-trip (mirrors payment_coupon_tracking).
    stageBookSelection = async (transactionId, userId, itemType, itemId, selection) => {
        const query = `
            insert into payment_book_selection
                (transaction_id, user_id, item_type, item_id, books_total, book_ids,
                 ship_name, ship_phone, ship_address, ship_city, ship_postcode, created_at)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            on conflict (transaction_id) do nothing
        `;
        const params = [
            transactionId,
            userId,
            itemType,
            itemId,
            selection.booksTotal,
            JSON.stringify(selection.books.map((b) => b.id)),
            selection.shipping.name,
            selection.shipping.phone,
            selection.shipping.address,
            selection.shipping.city,
            selection.shipping.postcode,
            parseInt(Date.now() / 1000)
        ];
        return this.query(query, params);
    }

    // Called from the IPN after a successful course/bundle enrolment (or for a standalone
    // book purchase): turns the staged book selection into confirmed course_book_purchase
    // rows (one per book). Idempotent — a replayed IPN inserts nothing new (unique index on
    // transaction_id+book_id). Safe to call when no selection was staged.
    fulfilBookSelection = async (transactionId) => {
        const staged = await this.query(
            `select * from payment_book_selection where transaction_id = $1`,
            [transactionId]
        );
        if (!staged.success || staged.data.length === 0) {
            return { success: true, data: [], fulfilled: 0 };
        }
        const sel = staged.data[0];
        let bookIds = sel.book_ids;
        if (typeof bookIds === 'string') {
            try { bookIds = JSON.parse(bookIds); } catch (e) { bookIds = []; }
        }
        if (!Array.isArray(bookIds) || bookIds.length === 0) {
            return { success: true, data: [], fulfilled: 0 };
        }

        const BookService = require('../managerial/book').BookService;
        const bookService = new BookService();
        const now = parseInt(Date.now() / 1000);

        // All books of the order or none: a failed insert rolls back and throws, so the IPN
        // reports it (a standalone book order is then FAILED, not a silent success).
        return this.withTransaction(async (client) => {
            let fulfilled = 0;
            for (const bookId of bookIds) {
                // Price snapshot + the course this book is attributed to
                const bookRow = await client.query(`select price from book where id = $1`, [bookId]);
                const price = bookRow.rows.length > 0 ? parseInt(bookRow.rows[0].price || 0) : 0;

                let courseId = null;
                let bundleId = null;
                if (sel.item_type === 'BUNDLE') {
                    bundleId = sel.item_id;
                    const c = await bookService.courseForBundleBook(sel.item_id, bookId);
                    if (c.success && c.data.length > 0) courseId = c.data[0].course_id;
                } else if (sel.item_type === 'BOOK') {
                    // standalone purchase — course_id and bundle_id both stay null
                } else {
                    courseId = sel.item_id; // COURSE
                }

                const ins = await client.query(
                    `insert into course_book_purchase
                        (user_id, course_id, bundle_id, book_id, amount_paid, transaction_id,
                         ship_name, ship_phone, ship_address, ship_city, ship_postcode,
                         fulfillment_status, timestamp)
                     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12)
                     on conflict (transaction_id, book_id) do nothing`,
                    [
                        sel.user_id, courseId, bundleId, bookId, price, transactionId,
                        sel.ship_name, sel.ship_phone, sel.ship_address, sel.ship_city, sel.ship_postcode,
                        now
                    ]
                );
                fulfilled += ins.rowCount;
            }
            return { success: true, fulfilled };
        });
    }

    // One checkout flow for every purchasable item; CHECKOUT_ITEMS holds what differs.
    // Order matters and is pinned by the payment tests: item check → (book) shipping →
    // coupon → transaction id → (course/bundle) attached books → coupon usage → gateway.
    initiateCheckout = async (itemType, body, itemId) => {
        const item = CHECKOUT_ITEMS[itemType];
        const [userResult, itemResult] = await Promise.all([
            this.query(`select * from managerial_auth where id = $1`, [body.user_id]),
            this.query(item.itemQuery, [itemId])
        ]);

        if (item.standalone && (!itemResult.success || itemResult.data.length === 0)) {
            return { success: false, error: 'Book not found or unavailable' };
        }

        // Get original price from the database row — never trust a client-supplied
        // price. (Previously the client could pass `eventId` to set an arbitrary
        // price; SSLCommerz only validates that paid == requested, so that let a
        // user buy at any price they chose.)
        const originalPrice = parseFloat(itemResult.data[0].price);
        let finalPrice = originalPrice;
        let couponId = null;

        // Shipping is mandatory for a standalone book purchase (unlike the
        // optional include-books shipping on course/bundle checkout).
        let shipping = null;
        if (item.standalone) {
            const s = body.shipping || {};
            if (!s.name || !s.phone || !s.address) {
                return { success: false, error: 'Shipping name, phone and address are required' };
            }
            shipping = { name: s.name, phone: s.phone, address: s.address, city: s.city || null, postcode: s.postcode || null };
        }

        if (body.coupon_code) {
            try {
                const validation = await couponService[item.couponValidator](body.coupon_code, itemId, body.user_id);
                if (!validation.valid) {
                    return { success: false, error: validation.error || 'Invalid coupon code' };
                }
                finalPrice = couponService.calculateDiscount(validation.coupon, originalPrice).finalPrice;
                couponId = validation.coupon.id;
            } catch (error) {
                logger.error(`Error processing ${item.label}coupon:`, error);
                return { success: false, error: 'Failed to process coupon' };
            }
        }

        // Generate transaction ID BEFORE payment initiation (this will be the access code sent to user)
        const transactionId = this.generateTransactionId(body.user_id, itemId);

        // Books shipped with this order. Course/bundle: the optional "include books"
        // selection, resolved + priced server-side and added on top of the (possibly
        // discounted) price AFTER the coupon usage is recorded, so the recorded discount
        // stays item-only. Book: the book itself, already in the price. Either way it is
        // staged by transaction_id so the IPN can fulfil it after the redirect round-trip.
        let bookSelection;
        if (item.standalone) {
            await this.stageBookSelection(transactionId, body.user_id, itemType, itemId, {
                booksTotal: originalPrice,
                books: [{ id: itemId }],
                shipping
            });
            bookSelection = { include: true, booksTotal: 0, shipping };
        } else {
            bookSelection = await this.resolveBookSelection(body, itemType, itemId);
            if (bookSelection.error) {
                return { success: false, error: bookSelection.error };
            }
            if (bookSelection.include) {
                await this.stageBookSelection(transactionId, body.user_id, itemType, itemId, bookSelection);
            }
        }

        // Record coupon usage IMMEDIATELY with payment_status='pending' (not waiting for
        // the IPN, which updates it to 'completed'), so analytics work even if the IPN
        // fails. A failure here never blocks the payment; it is logged for reconciliation.
        if (couponId) {
            await this.recordPendingCouponUsage(item, couponId, body.user_id, itemId, transactionId, {
                originalPrice,
                discountAmount: originalPrice - finalPrice,
                finalPrice
            });
        }

        finalPrice += bookSelection.booksTotal;

        const paymentCallbackBaseUrl = process.env.BACKEND_URL || process.env.PRODUCTION_URL || 'https://2m06xslkj8.execute-api.ap-southeast-2.amazonaws.com/prod';
        const pgwData = {
            total_amount: finalPrice.toFixed(2),
            currency: 'BDT',
            tran_id: transactionId, // Use generated transaction ID (access code) as tran_id
            success_url: `${paymentCallbackBaseUrl}/user/payment/success`,
            fail_url: `${paymentCallbackBaseUrl}/user/payment/failure`,
            cancel_url: `${paymentCallbackBaseUrl}/user/payment/cancel`,
            ipn_url: process.env.IPN_URL,
            shipping_method: bookSelection.include ? 'Courier' : 'NO',
            product_name: item.productName,
            product_category: 'Education',
            product_profile: bookSelection.include ? 'physical-goods' : 'digital-goods',
            value_a: body.user_id,
            value_b: itemId,
            value_c: finalPrice.toFixed(2), // Use final price (with discount if applicable)
            value_d: itemType, // coupon data is stored separately
            ...this.buildGatewayAddressPayload(userResult.data[0], bookSelection)
        };
        try {
            const apiResponse = await sslcommerz.initSession(pgwData);
            return {
                success: true,
                data: apiResponse.GatewayPageURL,
                coupon_applied: couponId ? true : false,
                original_price: originalPrice,
                final_price: finalPrice,
                discount_amount: couponId ? (originalPrice - (finalPrice - bookSelection.booksTotal)) : 0,
                ...(!item.standalone && {
                    books_included: bookSelection.include,
                    books_total: bookSelection.booksTotal
                })
            };
        } catch (e) {
            logger.error(`Error in ${item.method}:`, e);
            return {
                success: false,
                data: 'error occurred'
            };
        }
    }

    recordPendingCouponUsage = async (item, couponId, userId, itemId, transactionId, priceData) => {
        const context = { transactionId, couponId, itemType: item.label.trim() || 'course' };
        try {
            const [courseId, bundleId, bookId] = item.couponTarget(itemId);
            const recordResult = await couponService.recordUsage(
                couponId, userId, courseId, bundleId, priceData, 'pending', transactionId, bookId
            );
            if (recordResult.success) {
                console.log('Coupon usage recorded immediately (pending payment):', { ...context, usageId: recordResult.data?.usageId });
                return;
            }
            // A duplicate (idempotent retry) is fine: the usage is already recorded.
            const isDuplicateError = recordResult.error && (
                recordResult.error.includes('already used') ||
                recordResult.error.includes('pending payment')
            );
            if (isDuplicateError) {
                console.warn('Coupon usage already recorded (idempotency):', { ...context, error: recordResult.error });
            } else {
                logger.error('Failed to record coupon usage during payment initiation', recordResult.error, context);
            }
        } catch (error) {
            logger.error('Error processing coupon during payment initiation', error, context);
        }
    }

    initiatePayment = (body, course_id) => this.initiateCheckout('COURSE', body, course_id)

    initiatePaymentForBundle = (body, bundle_id) => this.initiateCheckout('BUNDLE', body, bundle_id)

    // Standalone book purchase — no course/bundle enrollment is granted; the
    // book itself is the purchase. Shipping is mandatory (physical good).
    initiatePaymentForBook = (body, book_id) => this.initiateCheckout('BOOK', body, book_id)

    // Get comprehensive payment history and enrollment details for a user
    getPaymentHistoryAndEnrollments = async (user_id) => {
        try {
            const userIdInt = parseInt(user_id);
            if (isNaN(userIdInt)) {
                return { success: false, error: 'Invalid user ID' };
            }

            const bundleQuery = `
                SELECT
                    bp.user_id,
                    bp.bundle_id,
                    bp.amount as paid_amount,
                    bp.transaction_id,
                    bp.timestamp as purchase_date,
                    bp.coupon_id,
                    b.id,
                    b.title,
                    b.price as original_price,
                    b.url as bundle_url,
                    'bundle' as purchase_type,
                    co.id as coupon_id_detail,
                    co.code as coupon_code,
                    co.name as coupon_name,
                    co.discount_type as coupon_discount_type,
                    co.discount_value as coupon_discount_value,
                    cu.discount_amount as coupon_discount_amount,
                    cu.original_price as coupon_original_price,
                    cu.final_price as coupon_final_price,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', c.id,
                                'title', c.title,
                                'url', c.url,
                                'price', c.price,
                                'enrollment_date', t.timestamp
                            )
                        ) FILTER (WHERE c.id IS NOT NULL),
                        '[]'::json
                    ) as courses
                FROM bundle_purchase bp
                JOIN bundle b ON bp.bundle_id = b.id
                LEFT JOIN coupons co ON bp.coupon_id = co.id
                LEFT JOIN coupon_usage cu ON cu.coupon_id = bp.coupon_id
                    AND cu.user_id = bp.user_id
                    AND cu.bundle_id = bp.bundle_id
                    AND cu.transaction_id = bp.transaction_id
                LEFT JOIN bundle_course bc ON b.id = bc.bundle_id
                LEFT JOIN course c ON bc.course_id = c.id
                LEFT JOIN takes t ON c.id = t.course_id AND t.user_id = bp.user_id
                WHERE bp.user_id = $1
                GROUP BY bp.user_id, bp.bundle_id, bp.amount, bp.transaction_id, bp.timestamp,
                         b.id, b.title, b.price, b.url, bp.coupon_id, co.id, co.code, co.name,
                         co.discount_type, co.discount_value, cu.discount_amount, cu.original_price, cu.final_price
                ORDER BY bp.timestamp DESC
            `;

            const courseQuery = `
                SELECT
                    t.user_id,
                    t.course_id,
                    t.amount as paid_amount,
                    t.transaction_id,
                    t.timestamp as enrollment_date,
                    t.coupon_id,
                    c.id,
                    c.title,
                    c.price as original_price,
                    c.url as course_url,
                    c.short_description,
                    c.instructor_list,
                    'individual' as purchase_type,
                    co.id as coupon_id_detail,
                    co.code as coupon_code,
                    co.name as coupon_name,
                    co.discount_type as coupon_discount_type,
                    co.discount_value as coupon_discount_value,
                    cu.discount_amount as coupon_discount_amount,
                    cu.original_price as coupon_original_price,
                    cu.final_price as coupon_final_price
                FROM takes t
                JOIN course c ON t.course_id = c.id
                LEFT JOIN coupons co ON t.coupon_id = co.id
                LEFT JOIN coupon_usage cu ON cu.coupon_id = t.coupon_id
                    AND cu.user_id = t.user_id
                    AND cu.course_id = t.course_id
                    AND cu.transaction_id = t.transaction_id
                WHERE t.user_id = $1
                ORDER BY t.timestamp DESC
            `;

            // Standalone book purchases only (course_id/bundle_id both null) — a
            // book bought as a course/bundle addon already surfaces via its
            // parent course/bundle entry above, so it's excluded here to avoid
            // double-counting.
            const bookQuery = `
                SELECT
                    cbp.user_id,
                    cbp.book_id,
                    cbp.amount_paid as paid_amount,
                    cbp.transaction_id,
                    cbp.timestamp as purchase_date,
                    cbp.fulfillment_status,
                    cbp.ship_name,
                    cbp.ship_phone,
                    cbp.ship_address,
                    cbp.ship_city,
                    cbp.ship_postcode,
                    b.id,
                    b.title,
                    b.image_url as book_image_url,
                    b.price as original_price,
                    'book' as purchase_type
                FROM course_book_purchase cbp
                JOIN book b ON b.id = cbp.book_id
                WHERE cbp.user_id = $1 AND cbp.course_id IS NULL AND cbp.bundle_id IS NULL
                ORDER BY cbp.timestamp DESC
            `;

            // Get all data in parallel for better performance
            const results = await Promise.all([
                // 1. Get all individual course purchases/enrollments (with coupon info)
                this.query(courseQuery, [userIdInt]),

                // 2. Get all bundle purchases with their courses (with coupon info)
                this.query(bundleQuery, [userIdInt]),

                // 3. Get user basic info
                // Fixed: Use phone and email columns instead of login
                this.query(`
                    SELECT name, phone, email, profile
                    FROM managerial_auth
                    WHERE id = $1
                `, [userIdInt]),

                // 4. Get standalone book purchases (shipping/fulfilment info)
                this.query(bookQuery, [userIdInt])
            ]);

            const individualCourses = results[0];
            const bundlePurchases = results[1];
            const userInfo = results[2];
            const bookPurchases = results[3];

            if (!individualCourses.success || !bundlePurchases.success || !userInfo.success || !bookPurchases.success) {
                return {
                    success: false,
                    error: 'Failed to retrieve payment history'
                };
            }

            const totalIndividualSpent = sumPaid(individualCourses.data);
            const totalBundleSpent = sumPaid(bundlePurchases.data);
            const totalBookSpent = sumPaid(bookPurchases.data);
            const totalSpent = totalIndividualSpent + totalBundleSpent + totalBookSpent;
            const totalCourses = individualCourses.data.length;
            const totalBundles = bundlePurchases.data.length;
            const totalBooks = bookPurchases.data.length;

            // Combine and sort all transactions by date (with formatted coupon info)
            const allTransactions = [
                ...individualCourses.data.map((course) => historyTransaction(course, course.enrollment_date, 'course')),
                ...bundlePurchases.data.map((bundle) => historyTransaction(bundle, bundle.purchase_date, 'bundle')),
                ...bookPurchases.data.map((book) => ({ ...book, transaction_date: book.purchase_date, item_type: 'book', coupon: null }))
            ].sort((a, b) => b.transaction_date - a.transaction_date);

            return {
                success: true,
                data: {
                    user_info: userInfo.data[0] || null,
                    summary: {
                        total_spent: totalSpent,
                        total_individual_spent: totalIndividualSpent,
                        total_bundle_spent: totalBundleSpent,
                        total_book_spent: totalBookSpent,
                        total_courses_enrolled: totalCourses,
                        total_bundles_purchased: totalBundles,
                        total_books_purchased: totalBooks,
                        total_transactions: allTransactions.length
                    },
                    individual_courses: individualCourses.data,
                    bundle_purchases: bundlePurchases.data,
                    book_purchases: bookPurchases.data,
                    all_transactions: allTransactions
                }
            };

        } catch (error) {
            logger.error('Error in getPaymentHistoryAndEnrollments:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    }

    // Log payment attempt to audit table
    logPaymentAttempt = async (logData) => {
        try {
            const {
                sslcommerz_tran_id,
                internal_transaction_id,
                user_id,
                item_id,
                item_type,
                amount,
                status,
                ipn_payload,
                processing_status,
                error_message,
                processing_result
            } = logData;

            const query = `
                INSERT INTO payment_audit_log (
                    sslcommerz_tran_id,
                    internal_transaction_id,
                    user_id,
                    item_id,
                    item_type,
                    amount,
                    status,
                    ipn_payload,
                    processing_status,
                    error_message,
                    processing_result,
                    timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const params = [
                sslcommerz_tran_id || null,
                internal_transaction_id || null,
                user_id || null,
                item_id || null,
                item_type || null,
                amount || null,
                status || 'PENDING',
                ipn_payload ? JSON.stringify(ipn_payload) : null,
                processing_status || 'PENDING',
                error_message || null,
                processing_result ? JSON.stringify(processing_result) : null,
                parseInt(Date.now() / 1000)
            ];

            const result = await this.query(query, params);
            return result;
        } catch (error) {
            logger.error('Error logging payment attempt:', error);
            // Don't throw - logging should never break payment processing
            return { success: false, error: error.message };
        }
    }

    // Update payment audit log after processing
    updatePaymentLog = async (logId, updateData) => {
        try {
            const { setSql, params, nextIndex } = buildUpdate(
                ['processing_status', 'error_message', 'processing_result', 'retry_count'],
                updateData,
                { transforms: { processing_result: JSON.stringify } }
            );
            const sets = setSql ? [setSql] : [];
            sets.push(`processed_at = $${nextIndex}`);

            const query = `
                UPDATE payment_audit_log
                SET ${sets.join(', ')}
                WHERE id = $${nextIndex + 1}
                RETURNING *
            `;

            const result = await this.query(query, [...params, parseInt(Date.now() / 1000), logId]);
            return result;
        } catch (error) {
            logger.error('Error updating payment log:', error);
            return { success: false, error: error.message };
        }
    }

    // Get payment audit logs for a user or transaction
    getPaymentAuditLogs = async (filters = {}) => {
        try {
            const {
                user_id,
                sslcommerz_tran_id,
                internal_transaction_id,
                item_type,
                status,
                processing_status,
                limit = 100,
                offset = 0
            } = filters;

            // Build query with JOINs for item name and user information
            let query = `
                SELECT 
                    pal.*,
                    COALESCE(c.title, b.title) AS item_name,
                    ma.name AS user_name,
                    ma.phone AS user_phone,
                    ma.email AS user_email
                FROM payment_audit_log pal
                LEFT JOIN course c ON (
                    pal.item_type = 'COURSE' 
                    AND pal.item_id = c.id
                )
                LEFT JOIN bundle b ON (
                    pal.item_type = 'BUNDLE' 
                    AND pal.item_id = b.id
                )
                LEFT JOIN managerial_auth ma ON pal.user_id = ma.id
                WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;

            if (user_id !== undefined && user_id !== null && user_id !== '') {
                query += ` AND pal.user_id = $${paramIndex++}`;
                params.push(user_id);
            }
            if (sslcommerz_tran_id) {
                query += ` AND pal.sslcommerz_tran_id = $${paramIndex++}`;
                params.push(sslcommerz_tran_id);
            }
            if (internal_transaction_id) {
                query += ` AND pal.internal_transaction_id = $${paramIndex++}`;
                params.push(internal_transaction_id);
            }
            if (item_type) {
                query += ` AND pal.item_type = $${paramIndex++}`;
                params.push(item_type);
            }
            if (status) {
                query += ` AND pal.status = $${paramIndex++}`;
                params.push(status);
            }
            if (processing_status) {
                query += ` AND pal.processing_status = $${paramIndex++}`;
                params.push(processing_status);
            }

            // Filter by accessible courses if provided
            if (filters.accessible_course_ids && Array.isArray(filters.accessible_course_ids)) {
                if (filters.accessible_course_ids.length === 0) {
                    // No accessible courses, return empty results
                    query += ` AND 1=0`;
                } else {
                    query += ` AND (
                        (pal.item_type = 'COURSE' AND pal.item_id = ANY($${paramIndex++}))
                        OR 
                        (pal.item_type = 'BUNDLE' AND EXISTS (
                            SELECT 1 FROM bundle_course bc 
                            WHERE bc.bundle_id = pal.item_id 
                            AND bc.course_id = ANY($${paramIndex++})
                        ))
                    )`;
                    params.push(filters.accessible_course_ids);
                    params.push(filters.accessible_course_ids);
                }
            }

            query += ` ORDER BY pal.timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, offset);

            const result = await this.query(query, params);
            return result;
        } catch (error) {
            logger.error('Error getting payment audit logs:', error);
            return { success: false, error: error.message };
        }
    }

    // Export payment audit logs (returns all matching records without pagination)
    exportPaymentAuditLogs = async (filters = {}) => {
        try {
            const {
                user_id,
                sslcommerz_tran_id,
                internal_transaction_id,
                item_type,
                status,
                processing_status
            } = filters;

            // Build query with JOINs for item name and user information
            let query = `
                SELECT 
                    pal.*,
                    COALESCE(c.title, b.title) AS item_name,
                    ma.name AS user_name,
                    ma.phone AS user_phone,
                    ma.email AS user_email
                FROM payment_audit_log pal
                LEFT JOIN course c ON (
                    pal.item_type = 'COURSE' 
                    AND pal.item_id = c.id
                )
                LEFT JOIN bundle b ON (
                    pal.item_type = 'BUNDLE' 
                    AND pal.item_id = b.id
                )
                LEFT JOIN managerial_auth ma ON pal.user_id = ma.id
                WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;

            if (user_id !== undefined && user_id !== null && user_id !== '') {
                query += ` AND pal.user_id = $${paramIndex++}`;
                params.push(user_id);
            }
            if (sslcommerz_tran_id) {
                query += ` AND pal.sslcommerz_tran_id = $${paramIndex++}`;
                params.push(sslcommerz_tran_id);
            }
            if (internal_transaction_id) {
                query += ` AND pal.internal_transaction_id = $${paramIndex++}`;
                params.push(internal_transaction_id);
            }
            if (item_type) {
                query += ` AND pal.item_type = $${paramIndex++}`;
                params.push(item_type);
            }
            if (status) {
                query += ` AND pal.status = $${paramIndex++}`;
                params.push(status);
            }
            if (processing_status) {
                query += ` AND pal.processing_status = $${paramIndex++}`;
                params.push(processing_status);
            }

            // Filter by accessible courses if provided
            if (filters.accessible_course_ids && Array.isArray(filters.accessible_course_ids)) {
                if (filters.accessible_course_ids.length === 0) {
                    // No accessible courses, return empty results
                    query += ` AND 1=0`;
                } else {
                    query += ` AND (
                        (pal.item_type = 'COURSE' AND pal.item_id = ANY($${paramIndex++}))
                        OR 
                        (pal.item_type = 'BUNDLE' AND EXISTS (
                            SELECT 1 FROM bundle_course bc 
                            WHERE bc.bundle_id = pal.item_id 
                            AND bc.course_id = ANY($${paramIndex++})
                        ))
                    )`;
                    params.push(filters.accessible_course_ids);
                    params.push(filters.accessible_course_ids);
                }
            }

            // No LIMIT or OFFSET - return all matching records
            query += ` ORDER BY pal.timestamp DESC`;

            const result = await this.query(query, params);
            return result;
        } catch (error) {
            logger.error('Error exporting payment audit logs:', error);
            return { success: false, error: error.message };
        }
    }

    // Manual reconciliation of a payment
    // This method never fails - payment is always marked as reconciled

}

module.exports = { PaymentService }



// {
//     status: 'SUCCESS',
//     failedreason: '',
//     amount: '599.00',
//     currency: 'BDT',
//     sessionkey: '7B0E244BBBC661742A97C14535661B28',
//     gw: {
//       visa: '',
//       master: '',
//       amex: '',
//       othercards: '',
//       internetbanking: '',
//       mobilebanking: 'dbblmobilebanking,bkash,mycash,mobilemoney,okwalletgw,dmoney,nagad'
//     },
//     redirectGatewayURL: 'https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=7B0E244BBBC661742A97C14535661B28&cardname=',
//     GatewayPageURL: 'https://epay-gw.sslcommerz.com/69691b1517f55fe4717c7b127ade962d2c0350c5',
//     directPaymentURL: 'https://epay-gw.sslcommerz.com/69691b1517f55fe4717c7b127ade962d2c0350c5',
//     design: {
//       main_bk_img: '',
//       main_bk_color: 'D5D8DC',
//       main_font_color: '1C2833',
//       title_bk_color: '1C2833',
//       title_font_color: '1C2833',
//       btn_yes_bk_color: 'D5D8DC',
//       btn_yes_font_color: '1C2833',
//       btn_no_bk_color: 'D5D8DC',
//       btn_no_font_color: '1C2833'
//     },
//     storeBanner: '',
//     storeLogo: 'https://securepay.sslcommerz.com/stores/logos/logo_SCZ100_200121.png?v=6646834632c9e',
//     token: '69691b1517f55fe4717c7b127ade962d2c0350c5',
//     desc: [
//       {
//         name: 'bKash',
//         type: 'mobilebanking',
//         logo: 'https://securepay.sslcommerz.com/gwprocess/v4/image/gw/bkash.png',      gw: 'bkash',
//         transAmt: '599.00',
//         payableAmt: '599.00',
//         charge: 0,
//         r_flag: '1',
//         redirectGatewayURL: 'https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=7B0E244BBBC661742A97C14535661B28&cardname=bkash'        
//       },
//       {
//         name: 'DBBL Mobile Banking',
//         type: 'mobilebanking',
//         logo: 'https://securepay.sslcommerz.com/gwprocess/v4/image/gw/dbblmobilebank.png',
//         gw: 'dbblmobilebanking',
//         transAmt: '599.00',
//         payableAmt: '599.00',
//         charge: 0,
//         r_flag: '1',
//         redirectGatewayURL: 'https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=7B0E244BBBC661742A97C14535661B28&cardname=dbblmobilebanking'
//       },
//       {
//         name: 'Nagad',
//         type: 'mobilebanking',
//         logo: 'https://securepay.sslcommerz.com/gwprocess/v4/image/gw/nagad.png',      gw: 'nagad',
//         transAmt: '599.00',
//         payableAmt: '599.00',
//         charge: '0.00',
//         r_flag: '1',
//         autoselect: '0',
//         redirectGatewayURL: 'https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=7B0E244BBBC661742A97C14535661B28&cardname=nagad'        
//       },
//       {
//         name: 'MYCASH-Mercantile Bank Limited',
//         type: 'mobilebanking',
//         logo: 'https://securepay.sslcommerz.com/gwprocess/v4/image/gw/mycash.png',
//         gw: 'mycash',
//         transAmt: '599.00',
//         payableAmt: '599.00',
//         charge: 0,
//         r_flag: '1',
//         redirectGatewayURL: 'https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=7B0E244BBBC661742A97C14535661B28&cardname=mycash'       
//       },
//       {
//         name: 'MobileMoney-Trust Bank Limited',
//         type: 'mobilebanking',
//         logo: 'https://securepay.sslcommerz.com/gwprocess/v4/image/gw/mobilemoney.png',
//         gw: 'mobilemoney',
//         transAmt: '599.00',
//         payableAmt: '599.00',
//         charge: 0,
//         r_flag: '1',
//         redirectGatewayURL: 'https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=7B0E244BBBC661742A97C14535661B28&cardname=mobilemoney'  
//       },
//       {
//         name: 'OKWallet-One Bank Limited',
//         type: 'mobilebanking',
//         logo: 'https://securepay.sslcommerz.com/gwprocess/v4/image/gw/okwallet.png',
//         gw: 'okwalletgw',
//         transAmt: '599.00',
//         payableAmt: '599.00',
//         charge: 0,
//         r_flag: '1',
//         redirectGatewayURL: 'https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=7B0E244BBBC661742A97C14535661B28&cardname=okwalletgw'   
//       },
//       {
//         name: 'Dmoney',
//         type: 'mobilebanking',
//         logo: 'https://securepay.sslcommerz.com/gwprocess/v4/image/gw/dmoney.png',
//         gw: 'dmoney',
//         transAmt: '599.00',
//         payableAmt: '599.00',
//         charge: 0,
//         r_flag: '1',
//         redirectGatewayURL: 'https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=REDIRECT&SESSIONKEY=7B0E244BBBC661742A97C14535661B28&cardname=dmoney'       
//       }
//     ],
//     tran_id: 'REF123',
//     is_multi_attempt: '1',
//     is_direct_pay_enable: '1',
//     payByNewCardURL: 'https://nook.sslcommerz.com/api/process_external_card/69691b1517f55fe4717c7b127ade962d2c0350c5',
//     emi_status: 0,
//     offer_status: 0
//   }
