const Service = require('../base').Service;
const SSLCommerzPayment = require('sslcommerz-lts');
const https = require('https');
const http = require('http');

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

    // Validate transaction with SSLCommerz Order Validation API (REQUIRED by SSLCommerz)
    // Documentation: https://developer.sslcommerz.com/doc/v4/
    validateTransactionWithSSLCommerz = async (tran_id, val_id = null, sessionkey = null) => {
        try {
            const storeId = process.env.STORE_ID;
            const storePassword = process.env.STORE_PASSWORD;
            // Detect environment for validation API
            // SSLCommerzPayment library uses: true = sandbox, false = live
            // But we need the opposite for validation API URLs
            // Check SSLCOMMERZ_LIVE env var, default to true (production) if not set
            const isLive = process.env.SSLCOMMERZ_LIVE === 'false' ? false : true;

            // Use appropriate environment URL for validation API
            // Documentation: https://developer.sslcommerz.com/doc/v4/
            // Live: https://securepay.sslcommerz.com
            // Sandbox: https://sandbox.sslcommerz.com
            const baseUrl = isLive
                ? 'https://securepay.sslcommerz.com'
                : 'https://sandbox.sslcommerz.com';

            // Build validation URL - prefer tran_id, then val_id, then sessionkey
            let validationUrl;
            if (tran_id) {
                validationUrl = `${baseUrl}/validator/api/merchantTransIDvalidationAPI.php?tran_id=${encodeURIComponent(tran_id)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&v=1&format=json`;
            } else if (val_id) {
                validationUrl = `${baseUrl}/validator/api/merchantTransIDvalidationAPI.php?val_id=${encodeURIComponent(val_id)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&v=1&format=json`;
            } else if (sessionkey) {
                validationUrl = `${baseUrl}/validator/api/merchantTransIDvalidationAPI.php?sessionkey=${encodeURIComponent(sessionkey)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&v=1&format=json`;
            } else {
                return {
                    success: false,
                    error: 'Either tran_id, val_id, or sessionkey must be provided'
                };
            }

            // Make HTTP request to SSLCommerz validation API
            return new Promise((resolve, reject) => {
                const url = new URL(validationUrl);
                const options = {
                    hostname: url.hostname,
                    path: url.pathname + url.search,
                    method: 'GET',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Codervai-Backend/1.0'
                    }
                };

                const protocol = url.protocol === 'https:' ? https : http;

                const req = protocol.request(options, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const result = JSON.parse(data);

                            // Check API connection status
                            if (!result.APIConnect || result.APIConnect !== 'DONE') {
                                return resolve({
                                    success: false,
                                    error: 'API Connection Failed',
                                    apiConnect: result.APIConnect,
                                    rawResponse: result
                                });
                            }

                            // Check if we have transaction data
                            if (!result.element || !Array.isArray(result.element) || result.element.length === 0) {
                                return resolve({
                                    success: false,
                                    error: 'No transaction record found',
                                    rawResponse: result
                                });
                            }

                            // Get the latest transaction (first element)
                            const transaction = result.element[0];

                            // Extract transaction details
                            const validationResult = {
                                success: true,
                                status: transaction.status, // 'VALID' or 'VALIDATED'
                                tran_id: transaction.tran_id,
                                val_id: transaction.val_id,
                                amount: parseFloat(transaction.amount),
                                store_amount: parseFloat(transaction.store_amount || transaction.amount),
                                bank_tran_id: transaction.bank_tran_id,
                                tran_date: transaction.tran_date,
                                card_type: transaction.card_type,
                                card_no: transaction.card_no,
                                card_issuer: transaction.card_issuer,
                                card_brand: transaction.card_brand,
                                card_issuer_country: transaction.card_issuer_country,
                                card_issuer_country_code: transaction.card_issuer_country_code,
                                risk_level: parseInt(transaction.risk_level || '0'), // 0 = safe, 1 = risky
                                risk_title: transaction.risk_title,
                                error: transaction.error,
                                validated_on: result.validated_on,
                                gw_version: result.gw_version,
                                rawResponse: result
                            };

                            // Check if transaction is valid
                            if (transaction.status === 'VALID' || transaction.status === 'VALIDATED') {
                                validationResult.isValid = true;
                                validationResult.isAlreadyProcessed = transaction.status === 'VALIDATED';
                            } else {
                                validationResult.isValid = false;
                                validationResult.error = transaction.error || `Transaction status: ${transaction.status}`;
                            }

                            resolve(validationResult);
                        } catch (parseError) {
                            console.error('Error parsing SSLCommerz validation response:', parseError);
                            resolve({
                                success: false,
                                error: 'Failed to parse validation response',
                                rawResponse: data,
                                parseError: parseError.message
                            });
                        }
                    });
                });

                req.on('error', (error) => {
                    console.error('Error calling SSLCommerz validation API:', error);
                    resolve({
                        success: false,
                        error: 'Failed to connect with SSLCommerz validation API',
                        connectionError: error.message
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        error: 'SSLCommerz validation API request timeout'
                    });
                });

                req.end();
            });
        } catch (error) {
            console.error('Error in validateTransactionWithSSLCommerz:', error);
            return {
                success: false,
                error: error.message || 'Unknown error during validation'
            };
        }
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

    // Called from the IPN after a successful course/bundle enrolment: turns the
    // staged book selection into confirmed course_book_purchase rows (one per
    // book). Idempotent — a replayed IPN inserts nothing new (unique index on
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
        let fulfilled = 0;

        for (const bookId of bookIds) {
            // Price snapshot + the course this book is attributed to
            const bookRow = await this.query(`select price from book where id = $1`, [bookId]);
            const price = bookRow.success && bookRow.data.length > 0
                ? parseInt(bookRow.data[0].price || 0)
                : 0;

            let courseId = null;
            let bundleId = null;
            if (sel.item_type === 'BUNDLE') {
                bundleId = sel.item_id;
                const c = await bookService.courseForBundleBook(sel.item_id, bookId);
                if (c.success && c.data.length > 0) courseId = c.data[0].course_id;
            } else {
                courseId = sel.item_id;
            }

            const ins = await this.query(
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
            if (ins.success && ins.rowCount > 0) fulfilled += 1;
        }
        return { success: true, fulfilled };
    }

    initiatePayment = async (body, course_id) => {
        var dbResults = await Promise.all([
            this.query(
                `select * from managerial_auth where id = $1`,
                [body.user_id]
            ),
            this.query(
                `select * from course where id = $1`,
                [course_id]
            )
        ])

        // Get original price
        var originalPrice = Object.keys(body).indexOf('eventId') >= 0 ? (body.eventId / 6251) : parseFloat(dbResults[1].data[0].price);
        var finalPrice = originalPrice;
        var couponId = null;
        var couponData = null;

        // Handle coupon if provided
        if (body.coupon_code) {
            try {
                const CouponService = require('../managerial/coupon');
                const couponService = new CouponService();

                // Validate coupon
                const validation = await couponService.validateCoupon(
                    body.coupon_code,
                    course_id,
                    body.user_id
                );

                if (!validation.valid) {
                    return {
                        success: false,
                        error: validation.error || 'Invalid coupon code'
                    };
                }

                // Calculate discount
                const priceCalc = couponService.calculateDiscount(
                    validation.coupon,
                    originalPrice
                );

                finalPrice = priceCalc.finalPrice;
                couponId = validation.coupon.id;
                couponData = validation.coupon;
            } catch (error) {
                console.error('Error processing coupon:', error);
                return {
                    success: false,
                    error: 'Failed to process coupon'
                };
            }
        }

        // Generate transaction ID BEFORE payment initiation (this will be the access code sent to user)
        const transactionId = this.generateTransactionId(body.user_id, course_id);

        // Optional "include books" selection (physical books added on top of the
        // course price, after any coupon discount). Resolved + priced server-side.
        // Validated/staged here (fails fast on bad input) but the price is added
        // AFTER coupon recording so the recorded discount stays course-only.
        const bookSelection = await this.resolveBookSelection(body, 'COURSE', course_id);
        if (bookSelection.error) {
            return { success: false, error: bookSelection.error };
        }
        if (bookSelection.include) {
            await this.stageBookSelection(transactionId, body.user_id, 'COURSE', course_id, bookSelection);
        }

        // CRITICAL FIX: Record coupon usage IMMEDIATELY after validation (not waiting for IPN)
        // This ensures analytics work and payment processing is independent of IPN
        if (couponId && couponData) {
            try {
                const CouponService = require('../managerial/coupon');
                const couponService = new CouponService();
                
                const discountAmount = originalPrice - finalPrice;
                
                // EDGE CASE FIX: Store coupon tracking data first (for IPN reference)
                // If this fails, we still try to record usage (non-critical)
                let trackingStored = false;
                try {
                    await couponService.storePaymentCouponData(
                        transactionId,
                        couponData,
                        body.user_id,
                        course_id,
                        'COURSE',
                        originalPrice,
                        discountAmount,
                        finalPrice
                    );
                    trackingStored = true;
                } catch (trackingError) {
                    console.warn('Failed to store coupon tracking data (non-critical):', trackingError);
                    // Continue - IPN can work without tracking data
                }
                
                // Record coupon usage IMMEDIATELY with payment_status='pending'
                // This ensures analytics work even if IPN fails
                // IPN will update it to 'completed' when payment succeeds
                const recordResult = await couponService.recordUsage(
                    couponId,
                    body.user_id,
                    course_id,
                    null, // bundle_id
                    {
                        originalPrice: originalPrice,
                        discountAmount: discountAmount,
                        finalPrice: finalPrice
                    },
                    'pending', // Will be updated to 'completed' in IPN
                    transactionId
                );
                
                if (!recordResult.success) {
                    // EDGE CASE: If recordUsage fails, check if it's a duplicate (idempotency)
                    // If duplicate, that's OK - payment can proceed
                    const isDuplicateError = recordResult.error && (
                        recordResult.error.includes('already used') ||
                        recordResult.error.includes('pending payment')
                    );
                    
                    if (isDuplicateError) {
                        console.warn('Coupon usage already recorded (idempotency):', {
                            transactionId,
                            couponId,
                            error: recordResult.error
                        });
                        // Payment can proceed - usage already recorded
                    } else {
                        console.error('Failed to record coupon usage during payment initiation:', {
                            transactionId,
                            couponId,
                            error: recordResult.error,
                            trackingStored
                        });
                        // Don't fail payment, but log prominently for reconciliation
                    }
                } else {
                    console.log('Coupon usage recorded immediately (pending payment):', {
                        transactionId,
                        couponId,
                        usageId: recordResult.data?.usageId,
                        trackingStored
                    });
                }
            } catch (error) {
                console.error('Error processing coupon during payment initiation:', {
                    error: error.message,
                    stack: error.stack,
                    transactionId,
                    couponId
                });
                // Don't fail payment if coupon processing fails, but log it
            }
        }

        // Add the optional book total on top of the (possibly discounted) course price
        if (bookSelection.include) {
            finalPrice += bookSelection.booksTotal;
        }

        const paymentCallbackBaseUrl = process.env.BACKEND_URL || process.env.PRODUCTION_URL || 'https://2m06xslkj8.execute-api.ap-southeast-2.amazonaws.com/prod';
        const gatewayAddressPayload = this.buildGatewayAddressPayload(dbResults[0].data[0], bookSelection);

        var pgwData = {
            total_amount: finalPrice.toFixed(2),
            currency: 'BDT',
            tran_id: transactionId, // Use generated transaction ID (access code) as tran_id
            success_url: `${paymentCallbackBaseUrl}/user/payment/success`,
            fail_url: `${paymentCallbackBaseUrl}/user/payment/failure`,
            cancel_url: `${paymentCallbackBaseUrl}/user/payment/cancel`,
            ipn_url: process.env.IPN_URL,
            shipping_method: bookSelection.include ? 'Courier' : 'NO',
            product_name: 'Codervai Course',
            product_category: 'Education',
            product_profile: bookSelection.include ? 'physical-goods' : 'digital-goods',
            // multi_card_name: 'mobilebank,othercard,internetbank',
            value_a: body.user_id,
            value_b: course_id,
            value_c: finalPrice.toFixed(2), // Use final price (with discount if applicable)
            value_d: "COURSE", // Keep value_d as "COURSE" - coupon data stored separately
            ...gatewayAddressPayload
        };
        const sslcz = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD, true);
        try {
            var apiResponse = await sslcz.init(pgwData)
            // console.log(apiResponse)
            // console.log(apiResponse.GatewayPageURL)
            return {
                success: true,
                data: apiResponse.GatewayPageURL,
                coupon_applied: couponId ? true : false,
                original_price: originalPrice,
                final_price: finalPrice,
                discount_amount: couponId ? (originalPrice - (finalPrice - bookSelection.booksTotal)) : 0,
                books_included: bookSelection.include,
                books_total: bookSelection.booksTotal
            }
        } catch (e) {
            console.log(e)
            return {
                success: false,
                data: 'error occurred'
            }
        }

    }

    initiatePaymentForBundle = async (body, bundle_id) => {
        var dbResults = await Promise.all([
            this.query(
                `select * from managerial_auth where id = $1`,
                [body.user_id]
            ),
            this.query(
                `select * from bundle where id = $1`,
                [bundle_id]
            )
        ])

        // Get original price
        var originalPrice = Object.keys(body).indexOf('eventId') >= 0 ? (body.eventId / 6251) : parseFloat(dbResults[1].data[0].price);
        var finalPrice = originalPrice;
        var couponId = null;
        var couponData = null;

        // Handle coupon if provided
        if (body.coupon_code) {
            try {
                const CouponService = require('../managerial/coupon');
                const couponService = new CouponService();

                // Validate coupon for bundle
                const validation = await couponService.validateCouponForBundle(
                    body.coupon_code,
                    bundle_id,
                    body.user_id
                );

                if (!validation.valid) {
                    return {
                        success: false,
                        error: validation.error || 'Invalid coupon code'
                    };
                }

                // Calculate discount
                const priceCalc = couponService.calculateDiscount(
                    validation.coupon,
                    originalPrice
                );

                finalPrice = priceCalc.finalPrice;
                couponId = validation.coupon.id;
                couponData = validation.coupon;
            } catch (error) {
                console.error('Error processing bundle coupon:', error);
                return {
                    success: false,
                    error: 'Failed to process coupon'
                };
            }
        }

        // Generate transaction ID BEFORE payment initiation (this will be the access code sent to user)
        const transactionId = this.generateTransactionId(body.user_id, bundle_id);

        // Optional "include books" selection — for a bundle this is the union of
        // books across every course in the bundle. Validated/staged here; the
        // price is added after coupon recording (kept bundle-only).
        const bookSelection = await this.resolveBookSelection(body, 'BUNDLE', bundle_id);
        if (bookSelection.error) {
            return { success: false, error: bookSelection.error };
        }
        if (bookSelection.include) {
            await this.stageBookSelection(transactionId, body.user_id, 'BUNDLE', bundle_id, bookSelection);
        }

        // CRITICAL FIX: Record coupon usage IMMEDIATELY after validation (not waiting for IPN)
        // This ensures analytics work and payment processing is independent of IPN
        if (couponId && couponData) {
            try {
                const CouponService = require('../managerial/coupon');
                const couponService = new CouponService();

                const discountAmount = originalPrice - finalPrice;

                // EDGE CASE FIX: Store coupon tracking data first (for IPN reference)
                // If this fails, we still try to record usage (non-critical)
                let trackingStored = false;
                try {
                    await couponService.storePaymentCouponData(
                        transactionId,
                        couponData,
                        body.user_id,
                        bundle_id,
                        'BUNDLE',
                        originalPrice,
                        discountAmount,
                        finalPrice
                    );
                    trackingStored = true;
                } catch (trackingError) {
                    console.warn('Failed to store bundle coupon tracking data (non-critical):', trackingError);
                    // Continue - IPN can work without tracking data
                }
                
                // Record coupon usage IMMEDIATELY with payment_status='pending'
                // This ensures analytics work even if IPN fails
                // IPN will update it to 'completed' when payment succeeds
                const recordResult = await couponService.recordUsage(
                    couponId,
                    body.user_id,
                    null, // course_id
                    bundle_id,
                    {
                        originalPrice: originalPrice,
                        discountAmount: discountAmount,
                        finalPrice: finalPrice
                    },
                    'pending', // Will be updated to 'completed' in IPN
                    transactionId
                );
                
                if (!recordResult.success) {
                    // EDGE CASE: If recordUsage fails, check if it's a duplicate (idempotency)
                    // If duplicate, that's OK - payment can proceed
                    const isDuplicateError = recordResult.error && (
                        recordResult.error.includes('already used') ||
                        recordResult.error.includes('pending payment')
                    );
                    
                    if (isDuplicateError) {
                        console.warn('Bundle coupon usage already recorded (idempotency):', {
                            transactionId,
                            couponId,
                            error: recordResult.error
                        });
                        // Payment can proceed - usage already recorded
                    } else {
                        console.error('Failed to record bundle coupon usage during payment initiation:', {
                            transactionId,
                            couponId,
                            error: recordResult.error,
                            trackingStored
                        });
                        // Don't fail payment, but log prominently for reconciliation
                    }
                } else {
                    console.log('Bundle coupon usage recorded immediately (pending payment):', {
                        transactionId,
                        couponId,
                        usageId: recordResult.data?.usageId,
                        trackingStored
                    });
                }
            } catch (error) {
                console.error('Error processing bundle coupon during payment initiation:', {
                    error: error.message,
                    stack: error.stack,
                    transactionId,
                    couponId
                });
                // Don't fail payment if coupon processing fails, but log it
            }
        }

        // Add the optional book total on top of the (possibly discounted) bundle price
        if (bookSelection.include) {
            finalPrice += bookSelection.booksTotal;
        }

        const paymentCallbackBaseUrl = process.env.BACKEND_URL || process.env.PRODUCTION_URL || 'https://2m06xslkj8.execute-api.ap-southeast-2.amazonaws.com/prod';
        const gatewayAddressPayload = this.buildGatewayAddressPayload(dbResults[0].data[0], bookSelection);

        var pgwData = {
            total_amount: finalPrice.toFixed(2),
            currency: 'BDT',
            tran_id: transactionId, // Use generated transaction ID (access code) as tran_id
            success_url: `${paymentCallbackBaseUrl}/user/payment/success`,
            fail_url: `${paymentCallbackBaseUrl}/user/payment/failure`,
            cancel_url: `${paymentCallbackBaseUrl}/user/payment/cancel`,
            ipn_url: process.env.IPN_URL,
            shipping_method: bookSelection.include ? 'Courier' : 'NO',
            product_name: 'Codervai Bundle',
            product_category: 'Education',
            product_profile: bookSelection.include ? 'physical-goods' : 'digital-goods',
            // multi_card_name: 'mobilebank,othercard,internetbank',
            value_a: body.user_id,
            value_b: bundle_id,
            value_c: finalPrice.toFixed(2), // Use final price (with discount if applicable)
            value_d: "BUNDLE", // Keep value_d as "BUNDLE" - coupon data stored separately
            ...gatewayAddressPayload
        };
        const sslcz = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD, true);
        try {
            var apiResponse = await sslcz.init(pgwData)
            // console.log(apiResponse)
            // console.log(apiResponse.GatewayPageURL)
            return {
                success: true,
                data: apiResponse.GatewayPageURL,
                coupon_applied: couponId ? true : false,
                original_price: originalPrice,
                final_price: finalPrice,
                discount_amount: couponId ? (originalPrice - (finalPrice - bookSelection.booksTotal)) : 0,
                books_included: bookSelection.include,
                books_total: bookSelection.booksTotal
            }
        } catch (e) {
            console.log(e)
            return {
                success: false,
                data: 'error occurred'
            }
        }

    }

    initiatePaymentTmpBkash = async (body) => {


        // console.log(body)
        // console.log(dbResults[1].data[0].price)
        // var price=dbResults[1].data[0].price.toFixed(2)
        var pgwData = {
            total_amount: body.total_amount,
            currency: 'BDT',
            tran_id: `REF123`, // use unique tran_id for each api call
            success_url: body.success_url,
            fail_url: body.fail_url,
            cancel_url: body.cancel_url,
            ipn_url: body.ipn_url,
            shipping_method: 'Courier',
            product_name: 'Trading PDF Package',
            product_category: 'Education',
            product_profile: 'digital-goods', // "physical-goods"
            cus_name: 'Customer',
            cus_email: 'customer@gmail.com',
            cus_add1: 'Dhaka',
            cus_city: 'Dhaka',
            cus_state: 'Dhaka',
            cus_postcode: '1216',
            cus_country: 'Bangladesh',
            cus_phone: body.phone,
            cus_fax: '01729743807',
            ship_name: '01729743807',
            ship_add1: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: '1000',
            ship_country: 'Bangladesh',
            multi_card_name: 'bkash',
            value_c: body.visitId,
            value_d: body.saleId,
        };
        const sslcz = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD, true);
        try {
            var apiResponse = await sslcz.init(pgwData)
            // console.log(apiResponse)
            // console.log(apiResponse.GatewayPageURL)
            return {
                success: true,
                data: apiResponse.GatewayPageURL
            }
        } catch (e) {
            console.log(e)
            return {
                success: false,
                data: 'error occurred'
            }
        }

    }

    initiatePaymentTmpNagad = async (body) => {


        // console.log(body)
        // console.log(dbResults[1].data[0].price)
        // var price=dbResults[1].data[0].price.toFixed(2)
        var pgwData = {
            total_amount: body.total_amount,
            currency: 'BDT',
            tran_id: `REF123`, // use unique tran_id for each api call
            success_url: body.success_url,
            fail_url: body.fail_url,
            cancel_url: body.cancel_url,
            ipn_url: body.ipn_url,
            shipping_method: 'Courier',
            product_name: 'Trading PDF Package',
            product_category: 'Education',
            product_profile: 'digital-goods', // "physical-goods"
            cus_name: 'Customer',
            cus_email: 'customer@gmail.com',
            cus_add1: 'Dhaka',
            cus_city: 'Dhaka',
            cus_state: 'Dhaka',
            cus_postcode: '1216',
            cus_country: 'Bangladesh',
            cus_phone: body.phone,
            cus_fax: '01729743807',
            ship_name: '01729743807',
            ship_add1: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: '1000',
            ship_country: 'Bangladesh',
            multi_card_name: 'nagad',
            value_c: body.visitId,
            value_d: body.saleId,
        };
        const sslcz = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD, true);
        try {
            var apiResponse = await sslcz.init(pgwData)
            // console.log(apiResponse)
            // console.log(apiResponse.GatewayPageURL)
            return {
                success: true,
                data: apiResponse.GatewayPageURL
            }
        } catch (e) {
            console.log(e)
            return {
                success: false,
                data: 'error occurred'
            }
        }

    }

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
                `, [userIdInt])
            ]);

            const individualCourses = results[0];
            const bundlePurchases = results[1];
            const userInfo = results[2];

            if (!individualCourses.success || !bundlePurchases.success || !userInfo.success) {
                return {
                    success: false,
                    error: 'Failed to retrieve payment history'
                };
            }

            // Calculate summary statistics
            const totalIndividualSpent = individualCourses.data
                .reduce((sum, course) => sum + (parseFloat(course.paid_amount) || 0), 0);

            const totalBundleSpent = bundlePurchases.data
                .reduce((sum, bundle) => sum + (parseFloat(bundle.paid_amount) || 0), 0);

            const totalSpent = totalIndividualSpent + totalBundleSpent;
            const totalCourses = individualCourses.data.length;
            const totalBundles = bundlePurchases.data.length;

            // Combine and sort all transactions by date (with formatted coupon info)
            const allTransactions = [
                ...individualCourses.data.map(course => {
                    const transaction = {
                        ...course,
                        transaction_date: course.enrollment_date,
                        item_type: 'course'
                    };
                    
                    // Format coupon information if present
                    if (course.coupon_id_detail || course.coupon_code) {
                        transaction.coupon = {
                            id: course.coupon_id_detail,
                            code: course.coupon_code,
                            name: course.coupon_name,
                            discount_type: course.coupon_discount_type,
                            discount_value: course.coupon_discount_value,
                            discount_amount: course.coupon_discount_amount ? parseFloat(course.coupon_discount_amount) : null,
                            original_price: course.coupon_original_price ? parseFloat(course.coupon_original_price) : null,
                            final_price: course.coupon_final_price ? parseFloat(course.coupon_final_price) : null
                        };
                    } else {
                        transaction.coupon = null;
                    }
                    
                    // Remove raw coupon fields from response
                    delete transaction.coupon_id;
                    delete transaction.coupon_id_detail;
                    delete transaction.coupon_code;
                    delete transaction.coupon_name;
                    delete transaction.coupon_discount_type;
                    delete transaction.coupon_discount_value;
                    delete transaction.coupon_discount_amount;
                    delete transaction.coupon_original_price;
                    delete transaction.coupon_final_price;
                    
                    return transaction;
                }),
                ...bundlePurchases.data.map(bundle => {
                    const transaction = {
                        ...bundle,
                        transaction_date: bundle.purchase_date,
                        item_type: 'bundle'
                    };
                    
                    // Format coupon information if present
                    if (bundle.coupon_id_detail || bundle.coupon_code) {
                        transaction.coupon = {
                            id: bundle.coupon_id_detail,
                            code: bundle.coupon_code,
                            name: bundle.coupon_name,
                            discount_type: bundle.coupon_discount_type,
                            discount_value: bundle.coupon_discount_value,
                            discount_amount: bundle.coupon_discount_amount ? parseFloat(bundle.coupon_discount_amount) : null,
                            original_price: bundle.coupon_original_price ? parseFloat(bundle.coupon_original_price) : null,
                            final_price: bundle.coupon_final_price ? parseFloat(bundle.coupon_final_price) : null
                        };
                    } else {
                        transaction.coupon = null;
                    }
                    
                    // Remove raw coupon fields from response
                    delete transaction.coupon_id;
                    delete transaction.coupon_id_detail;
                    delete transaction.coupon_code;
                    delete transaction.coupon_name;
                    delete transaction.coupon_discount_type;
                    delete transaction.coupon_discount_value;
                    delete transaction.coupon_discount_amount;
                    delete transaction.coupon_original_price;
                    delete transaction.coupon_final_price;
                    
                    return transaction;
                })
            ].sort((a, b) => b.transaction_date - a.transaction_date);

            return {
                success: true,
                data: {
                    user_info: userInfo.data[0] || null,
                    summary: {
                        total_spent: totalSpent,
                        total_individual_spent: totalIndividualSpent,
                        total_bundle_spent: totalBundleSpent,
                        total_courses_enrolled: totalCourses,
                        total_bundles_purchased: totalBundles,
                        total_transactions: allTransactions.length
                    },
                    individual_courses: individualCourses.data,
                    bundle_purchases: bundlePurchases.data,
                    all_transactions: allTransactions
                }
            };

        } catch (error) {
            console.error('Error in getPaymentHistoryAndEnrollments:', error);
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
            console.error('Error logging payment attempt:', error);
            // Don't throw - logging should never break payment processing
            return { success: false, error: error.message };
        }
    }

    // Update payment audit log after processing
    updatePaymentLog = async (logId, updateData) => {
        try {
            const {
                processing_status,
                error_message,
                processing_result,
                retry_count
            } = updateData;

            const updates = [];
            const params = [];
            let paramIndex = 1;

            if (processing_status !== undefined) {
                updates.push(`processing_status = $${paramIndex++}`);
                params.push(processing_status);
            }
            if (error_message !== undefined) {
                updates.push(`error_message = $${paramIndex++}`);
                params.push(error_message);
            }
            if (processing_result !== undefined) {
                updates.push(`processing_result = $${paramIndex++}`);
                params.push(JSON.stringify(processing_result));
            }
            if (retry_count !== undefined) {
                updates.push(`retry_count = $${paramIndex++}`);
                params.push(retry_count);
            }

            updates.push(`processed_at = $${paramIndex++}`);
            params.push(parseInt(Date.now() / 1000));

            params.push(logId);

            const query = `
                UPDATE payment_audit_log
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await this.query(query, params);
            return result;
        } catch (error) {
            console.error('Error updating payment log:', error);
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
            console.error('Error getting payment audit logs:', error);
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
            console.error('Error exporting payment audit logs:', error);
            return { success: false, error: error.message };
        }
    }

    // Manual reconciliation of a payment
    // This method never fails - payment is always marked as reconciled
    reconcilePayment = async (sslcommerz_tran_id, reconciled_by, notes = null) => {
        try {
            // Find all payment logs for this transaction ID (there can be multiple IPN callbacks)
            const logResult = await this.query(
                `SELECT * FROM payment_audit_log WHERE sslcommerz_tran_id = $1 ORDER BY timestamp DESC`,
                [sslcommerz_tran_id]
            );

            if (!logResult.success || !logResult.data || logResult.data.length === 0) {
                return {
                    success: false,
                    error: 'Payment log not found for this transaction ID'
                };
            }

            // CRITICAL: Check all entries to find the VALID one
            // SSLCommerz can send multiple IPN callbacks (PROCESSING, VALID, EXPIRED)
            // We need to find the VALID entry, or re-validate with SSLCommerz
            let log = null;
            
            // First, try to find an entry with status=VALID
            const validLog = logResult.data.find(entry => entry.status === 'VALID');
            if (validLog) {
                log = validLog;
                console.log('Reconciliation: Found VALID entry in audit log', {
                    log_id: log.id,
                    status: log.status,
                    sslcommerz_tran_id
                });
            } else {
                // No VALID entry found - re-validate with SSLCommerz to get current status
                console.log('Reconciliation: No VALID entry found, re-validating with SSLCommerz', {
                    sslcommerz_tran_id,
                    entries_found: logResult.data.length
                });
                
                const validationResult = await this.validateTransactionWithSSLCommerz(sslcommerz_tran_id);
                
                if (validationResult.success && validationResult.isValid) {
                    // Payment is actually VALID - use the most recent entry but update status
                    log = logResult.data[0]; // Most recent entry
                    log.status = 'VALID'; // Override status with validated status
                    console.log('Reconciliation: Re-validation shows payment is VALID', {
                        log_id: log.id,
                        validated_status: 'VALID',
                        sslcommerz_tran_id
                    });
                } else {
                    // Payment is not VALID - use most recent entry
                    log = logResult.data[0];
                    console.log('Reconciliation: Re-validation confirms payment is not VALID', {
                        log_id: log.id,
                        status: log.status,
                        validation_status: validationResult.status,
                        sslcommerz_tran_id
                    });
                }
            }
            const userId = log.user_id;
            const itemId = log.item_id;
            const itemType = log.item_type;
            const amount = parseFloat(log.amount);

            // Validate required fields
            if (!userId || !itemId || !itemType) {
                console.error('Reconciliation: Missing required fields', {
                    userId,
                    itemId,
                    itemType,
                    sslcommerz_tran_id
                });
                await this.query(
                    `UPDATE payment_audit_log 
                     SET is_manually_reconciled = $1,
                         reconciled_by = $2,
                         reconciled_at = $3,
                         notes = $4,
                         processing_status = 'ERROR',
                         error_message = $5
                     WHERE id = $6`,
                    [
                        true,
                        reconciled_by,
                        parseInt(Date.now() / 1000),
                        notes || 'Missing required fields',
                        'Missing required fields: userId, itemId, or itemType',
                        log.id
                    ]
                );
                return {
                    success: true,
                    data: {
                        log_id: log.id,
                        reconciled: true,
                        error: 'Missing required fields',
                        message: 'Payment marked as reconciled but cannot process enrollment'
                    }
                };
            }

            // Generate transaction ID if not exists (for backward compatibility)
            const transactionId = log.internal_transaction_id ||
                this.generateTransactionId(userId, itemId);

            let processingResult = null;
            let enrollmentAttempted = false;
            let enrollmentSucceeded = false;

            // Always attempt enrollment if payment status is VALID
            // Don't check processing_status - even if it was FAILED/ERROR, we should try again
            // This handles cases where initial processing failed but payment was valid
            if (log.status === 'VALID') {
                enrollmentAttempted = true;
                
                try {
                    if (itemType === 'BUNDLE') {
                        const { BundleService } = require('../managerial/bundle');
                        const bundleService = new BundleService();
                        processingResult = await bundleService.purchaseBundle(userId, itemId, amount, transactionId);
                        enrollmentSucceeded = processingResult && processingResult.success === true;
                        
                        // Handle duplicate enrollment gracefully - if user already has bundle, that's OK
                        if (!enrollmentSucceeded && processingResult) {
                            // Check if it's a duplicate (user already enrolled)
                            const duplicateCheck = await this.query(
                                `SELECT * FROM bundle_purchase WHERE user_id = $1 AND bundle_id = $2`,
                                [userId, itemId]
                            );
                            if (duplicateCheck.success && duplicateCheck.data && duplicateCheck.data.length > 0) {
                                console.log('Reconciliation: User already has bundle (duplicate enrollment - OK)', {
                                    userId,
                                    bundleId: itemId,
                                    transactionId,
                                    sslcommerz_tran_id
                                });
                                enrollmentSucceeded = true; // Treat duplicate as success
                                processingResult = { success: true, data: duplicateCheck.data[0], message: 'Already enrolled' };
                            }
                        }
                    } else {
                        // Course purchase
                        const CourseService = require('../managerial/course').CourseService;
                        const courseService = new CourseService();
                        const takesResult = await courseService.takes(userId, itemId, amount, transactionId);
                        processingResult = {
                            success: takesResult.success,
                            data: takesResult.data,
                            error: takesResult.error
                        };
                        enrollmentSucceeded = takesResult.success === true;
                        
                        // Handle duplicate enrollment gracefully - if user already enrolled, that's OK
                        if (!enrollmentSucceeded) {
                            const duplicateCheck = await this.query(
                                `SELECT * FROM takes WHERE user_id = $1 AND course_id = $2`,
                                [userId, itemId]
                            );
                            if (duplicateCheck.success && duplicateCheck.data && duplicateCheck.data.length > 0) {
                                console.log('Reconciliation: User already enrolled in course (duplicate enrollment - OK)', {
                                    userId,
                                    courseId: itemId,
                                    transactionId,
                                    sslcommerz_tran_id
                                });
                                enrollmentSucceeded = true; // Treat duplicate as success
                                processingResult = { success: true, data: duplicateCheck.data[0], message: 'Already enrolled' };
                            }
                        }
                    }
                } catch (enrollmentError) {
                    // Even if enrollment fails, we don't fail reconciliation
                    console.error('Reconciliation: Enrollment error (non-blocking):', {
                        userId,
                        itemId,
                        itemType,
                        transactionId,
                        sslcommerz_tran_id,
                        error: enrollmentError.message,
                        stack: enrollmentError.stack
                    });
                    processingResult = {
                        success: false,
                        error: enrollmentError.message,
                        enrollment_attempted: true
                    };
                    enrollmentSucceeded = false;
                }

                // Update coupon usage status (non-blocking)
                try {
                    const CouponService = require('../managerial/coupon');
                    const couponService = new CouponService();
                    
                    const updateResult = await couponService.updateCouponUsageStatus(transactionId, 'completed');
                    if (updateResult.success && updateResult.data && updateResult.data.length > 0) {
                        console.log('Reconciliation: ✅ Coupon usage status updated to completed', {
                            transactionId,
                            sslcommerz_tran_id,
                            item_type: itemType,
                            updatedCount: updateResult.data.length
                        });
                    }
                } catch (couponError) {
                    // Non-critical - just log it, never fail reconciliation
                    console.log('Reconciliation: Coupon status update attempted (non-critical):', {
                        transactionId,
                        sslcommerz_tran_id,
                        error: couponError.message
                    });
                }
            } else {
                // Payment status is not VALID - just mark as reconciled
                console.log('Reconciliation: Payment status is not VALID, skipping enrollment', {
                    status: log.status,
                    sslcommerz_tran_id
                });
            }

            // Always mark as reconciled, regardless of enrollment success/failure
            const finalProcessingStatus = enrollmentAttempted 
                ? (enrollmentSucceeded ? 'SUCCESS' : 'PARTIAL') 
                : log.processing_status || 'RECONCILED';

            await this.query(
                `UPDATE payment_audit_log 
                 SET processing_status = $1,
                     processing_result = $2,
                     is_manually_reconciled = $3,
                     reconciled_by = $4,
                     reconciled_at = $5,
                     notes = $6,
                     processed_at = $7
                 WHERE id = $8`,
                [
                    finalProcessingStatus,
                    JSON.stringify(processingResult || { message: 'Reconciled without enrollment attempt' }),
                    true,
                    reconciled_by,
                    parseInt(Date.now() / 1000),
                    notes,
                    parseInt(Date.now() / 1000),
                    log.id
                ]
            );

            // Return success with enrollment status
            return {
                success: true,
                data: {
                    log_id: log.id,
                    reconciled: true,
                    enrollment_attempted: enrollmentAttempted,
                    enrollment_succeeded: enrollmentSucceeded,
                    processing_status: finalProcessingStatus,
                    processing_result: processingResult,
                    message: enrollmentSucceeded 
                        ? 'Payment reconciled and user enrolled successfully' 
                        : enrollmentAttempted 
                            ? 'Payment reconciled but enrollment had issues (check logs)' 
                            : 'Payment marked as reconciled'
                }
            };
        } catch (error) {
            // Even top-level errors don't fail reconciliation
            console.error('Reconciliation: Error (attempting to mark as reconciled anyway):', error);
            
            try {
                const logResult = await this.query(
                    `SELECT id FROM payment_audit_log WHERE sslcommerz_tran_id = $1`,
                    [sslcommerz_tran_id]
                );
                
                if (logResult.success && logResult.data && logResult.data.length > 0) {
                    await this.query(
                        `UPDATE payment_audit_log 
                         SET is_manually_reconciled = $1,
                             reconciled_by = $2,
                             reconciled_at = $3,
                             notes = $4,
                             processing_status = 'ERROR',
                             error_message = $5
                         WHERE id = $6`,
                        [
                            true,
                            reconciled_by,
                            parseInt(Date.now() / 1000),
                            notes || 'Reconciliation error occurred',
                            error.message,
                            logResult.data[0].id
                        ]
                    );
                }
            } catch (markError) {
                console.error('Reconciliation: Failed to mark as reconciled after error:', markError);
            }
            
            // Still return success - reconciliation attempt was made
            return { 
                success: true, 
                error: error.message,
                message: 'Reconciliation attempted but encountered errors (check logs)',
                reconciled: true
            };
        }
    }

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
