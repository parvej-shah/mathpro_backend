// SSLCommerz IPN processing (moved out of controllers/user/payment.js ipn).
//
//   handleIpn(body) → parse → audit → verify with the gateway → fulfil the item → notify
//
// Every outcome is a reply body; the controller always answers 200 (SSLCommerz expects 200
// even on errors). Each step updates the payment_audit_log row created for this IPN.
const sslcommerz = require('../../integrations/sslcommerz');
const { PaymentService } = require('./payment');
const { CourseService } = require('../managerial/course');
const { BundleService } = require('../managerial/bundle');
const CouponService = require('../managerial/coupon');
const { notifyBundlePurchase, notifyCoursePurchase } = require('./purchaseNotifications');
const logger = require('../../util/logger');

const paymentService = new PaymentService();
const courseService = new CourseService();
const bundleService = new BundleService();
const couponService = new CouponService();

const query = (sql, params) => paymentService.query(sql, params);

// Enrolment items: course and bundle grant access, then fulfil any included books and notify.
// The book (standalone) purchase is handled by fulfilBook.
const ENROLMENTS = {
    COURSE: {
        label: 'Course',
        resultKey: 'enrollment',
        failure: 'Course enrollment failed',
        enrol: (ipn, couponId) => courseService.takes(ipn.userId, ipn.itemId, ipn.amount, ipn.transactionId, couponId),
        notify: (ipn) => notifyCoursePurchase(query, ipn)
    },
    BUNDLE: {
        label: 'Bundle',
        resultKey: 'purchase',
        failure: 'Bundle purchase failed',
        enrol: (ipn) => bundleService.purchaseBundle(ipn.userId, ipn.itemId, ipn.amount, ipn.transactionId),
        notify: (ipn) => notifyBundlePurchase(query, bundleService, ipn)
    }
};

// The payment_audit_log row for one IPN; a no-op when the initial insert failed.
class IpnAudit {
    constructor() {
        this.id = null;
    }

    update = async (fields) => {
        if (this.id) await paymentService.updatePaymentLog(this.id, fields);
    }
}

const riskFields = (validation) => ({
    risk_level: validation?.risk_level || null,
    risk_title: validation?.risk_title || null
});

// Reads the fields our initiate step put in value_a..value_d.
function parseIpn(body) {
    const sslcommerzTranId = body.tran_id || body.transaction_id || null;
    const userId = body.value_a ? parseInt(body.value_a) : null;
    let itemId = null;
    if (body.value_b !== undefined && body.value_b !== null) {
        const parsed = parseInt(body.value_b);
        itemId = isNaN(parsed) ? null : parsed;
    }
    const amount = body.value_c ? parseFloat(body.value_c) : null;
    const itemType = body.value_d || (itemId ? 'COURSE' : null); // Default to COURSE if not specified

    // Our tran_id is the transaction id (access code) generated at initiation. Old payments
    // carried the hardcoded "REF123"; for those (or a missing tran_id) generate one.
    let transactionId = null;
    if (sslcommerzTranId && sslcommerzTranId !== 'REF123') {
        transactionId = sslcommerzTranId;
    } else if (userId && itemId) {
        transactionId = paymentService.generateTransactionId(userId, itemId);
    }
    return { sslcommerzTranId, userId, itemId, amount, itemType, transactionId, status: body.status, ipnAmount: body.amount };
}

// Gateway checks (required by SSLCommerz to prevent fraud): the tran_id query for status,
// risk and amount, then the val_id order record for who bought what. Returns
// { reply } when the IPN must stop here, else { validation } with ipn.amount set to the
// validated amount.
async function verifyWithGateway(ipn, body, audit) {
    const validation = await sslcommerz.validateTransaction(ipn.sslcommerzTranId, body.val_id || null, body.sessionkey || null);
    console.log('SSLCommerz Validation Result:', {
        success: validation.success,
        isValid: validation.isValid,
        status: validation.status,
        risk_level: validation.risk_level,
        amount: validation.amount
    });

    await audit.update({
        processing_status: 'VALIDATING',
        processing_result: { validation_attempted: true, validation_success: validation.success, validation_result: validation }
    });

    if (!validation.success) {
        const errorMsg = `SSLCommerz validation failed: ${validation.error}`;
        logger.error('IPN Validation Error:', errorMsg);
        await audit.update({ processing_status: 'ERROR', error_message: errorMsg, processing_result: validation });
        return { reply: { success: false, error: errorMsg, validation_error: validation.error } };
    }

    if (!validation.isValid) {
        const errorMsg = validation.error || `Transaction status: ${validation.status}`;
        logger.error('IPN: Transaction not valid:', errorMsg);
        await audit.update({ processing_status: 'FAILED', error_message: errorMsg, processing_result: validation });
        return { reply: { success: false, error: errorMsg, transaction_status: validation.status } };
    }

    if (validation.isAlreadyProcessed) {
        await audit.update({
            processing_status: 'ALREADY_PROCESSED',
            error_message: 'Transaction was already validated and processed',
            processing_result: validation
        });
        return { reply: { success: true, message: 'Transaction already processed', already_processed: true } };
    }

    // Risky payments (risk_level 1) are logged but still processed (merchant decision).
    if (validation.risk_level === 1) {
        console.warn('IPN: RISKY PAYMENT DETECTED!', {
            risk_title: validation.risk_title,
            risk_level: validation.risk_level,
            tran_id: ipn.sslcommerzTranId
        });
        await audit.update({
            processing_status: 'RISKY',
            error_message: `Risky payment detected: ${validation.risk_title || 'High risk'}`,
            processing_result: validation
        });
    }

    // The validated amount is authoritative: enforce it whenever it is present, even if
    // the IPN omitted value_c (a forged/legacy IPN can), then adopt it.
    if (validation.amount) {
        if (ipn.amount && Math.abs(parseFloat(ipn.amount) - validation.amount) > 0.01) { // 0.01 BDT rounding
            const errorMsg = `Amount mismatch: IPN amount (${ipn.amount}) != Validated amount (${validation.amount})`;
            logger.error('IPN Amount Mismatch:', errorMsg);
            await audit.update({ processing_status: 'ERROR', error_message: errorMsg, processing_result: validation });
            return { reply: { success: false, error: errorMsg, ipn_amount: ipn.amount, validated_amount: validation.amount } };
        }
        ipn.amount = validation.amount;
    }

    // value_a/value_b/value_d (user, item, item type) come from this POST, which anyone can
    // send. They must match the gateway's order record for this payment, or a real cheap
    // payment could be replayed against another item or user.
    const order = await sslcommerz.validateOrder(body.val_id);
    const record = order.success ? order.record : {};
    const matches = ['VALID', 'VALIDATED'].includes(record.status)
        && record.tran_id === ipn.sslcommerzTranId
        && ['value_a', 'value_b', 'value_d'].every((f) => String(record[f] ?? '') === String(body[f] ?? ''));
    if (!matches) {
        const errorMsg = 'IPN does not match the payment recorded by SSLCommerz';
        logger.error('IPN: gateway record mismatch', undefined, { tran_id: ipn.sslcommerzTranId, val_id: body.val_id || null });
        await audit.update({ processing_status: 'ERROR', error_message: errorMsg, processing_result: { validation, order } });
        return { reply: { success: false, error: errorMsg } };
    }
    return { validation };
}

// Coupon usage was recorded as 'pending' at initiation; returns its coupon id, if any.
async function findCouponId(transactionId) {
    try {
        const usage = await couponService.getUsageCouponIds(transactionId);
        if (usage.success && usage.data.length > 0) return usage.data[0].coupon_id;
    } catch (couponError) {
        logger.error('IPN: Error getting coupon data (non-critical):', couponError);
    }
    return null;
}

// Marks the pending coupon usage 'completed' (by transaction id, so it works even when the
// coupon lookup failed). Never fails the payment.
async function completeCouponUsage(label, transactionId, couponId) {
    const context = { transactionId, couponId: couponId || 'unknown' };
    try {
        const updateResult = await couponService.updateCouponUsageStatus(transactionId, 'completed');
        if (!updateResult.success) {
            console.warn(`IPN: Failed to update ${label} coupon usage status (non-critical):`, { ...context, error: updateResult.error });
        } else if (updateResult.data && updateResult.data.length > 0) {
            console.log(`IPN: ${label} coupon usage status updated to completed`, { ...context, updatedCount: updateResult.data.length });
        }
    } catch (couponError) {
        logger.error(`IPN: Error updating ${label} coupon usage status (non-critical)`, couponError, context);
    }
}

// Course / bundle: enrol, complete the coupon, then fulfil included books and notify.
async function fulfilEnrolment(kind, ipn, validation, couponId, audit) {
    const result = await kind.enrol(ipn, couponId);
    await completeCouponUsage(kind.label.toLowerCase(), ipn.transactionId, couponId);

    if (!result.success) {
        const errorMsg = result.error || kind.failure;
        logger.error(`${kind.failure}:`, errorMsg);
        await audit.update({ processing_status: 'FAILED', error_message: errorMsg, processing_result: result });
        return { success: false, error: errorMsg };
    }

    // Optional physical books included with the course/bundle; an admin can reconcile a failure.
    try {
        const bookFulfil = await paymentService.fulfilBookSelection(ipn.transactionId);
        if (bookFulfil.fulfilled > 0) {
            console.log(`IPN: ${kind.label} book purchase(s) recorded`, { transactionId: ipn.transactionId, fulfilled: bookFulfil.fulfilled });
        }
    } catch (bookError) {
        logger.error(`IPN: Error fulfilling ${kind.label.toLowerCase()} book selection (non-critical)`, bookError, { transactionId: ipn.transactionId });
    }

    await kind.notify(ipn);

    await audit.update({
        processing_status: 'SUCCESS',
        processing_result: { validation, [kind.resultKey]: result, ...riskFields(validation) }
    });
    return {
        success: true,
        message: `${kind.label} purchase processed successfully`,
        risk_level: validation?.risk_level || 0
    };
}

// Standalone book: no enrolment; the staged book selection becomes the purchase
// (course_book_purchase with course_id and bundle_id null).
async function fulfilBook(ipn, validation, couponId, audit) {
    await completeCouponUsage('book', ipn.transactionId, couponId);
    try {
        const bookFulfil = await paymentService.fulfilBookSelection(ipn.transactionId);
        await audit.update({
            processing_status: 'SUCCESS',
            processing_result: { validation, fulfilled: bookFulfil.fulfilled, ...riskFields(validation) }
        });
        return { success: true, message: 'Book purchase processed successfully', risk_level: validation?.risk_level || 0 };
    } catch (bookError) {
        logger.error('IPN: Error fulfilling standalone book purchase', bookError, { transactionId: ipn.transactionId });
        await audit.update({ processing_status: 'FAILED', error_message: bookError.message });
        return { success: false, error: bookError.message || 'Book purchase processing failed' };
    }
}

async function fulfil(ipn, validation, audit) {
    const couponId = await findCouponId(ipn.transactionId);
    if (ipn.itemType === 'BOOK') return fulfilBook(ipn, validation, couponId, audit);
    // Anything that isn't a bundle or a book is a course (COURSE or legacy IPNs).
    const kind = ipn.itemType === 'BUNDLE' ? ENROLMENTS.BUNDLE : ENROLMENTS.COURSE;
    return fulfilEnrolment(kind, ipn, validation, couponId, audit);
}

async function handleIpn(body) {
    const audit = new IpnAudit();
    try {
        if (!body.status) {
            logger.error('IPN: Missing status field', body);
            await paymentService.logPaymentAttempt({
                sslcommerz_tran_id: body.tran_id || body.transaction_id || null,
                status: 'INVALID',
                ipn_payload: body,
                processing_status: 'ERROR',
                error_message: 'Missing status field'
            });
            return { success: false, error: 'Missing status field' };
        }

        const ipn = parseIpn(body);
        const logResult = await paymentService.logPaymentAttempt({
            sslcommerz_tran_id: ipn.sslcommerzTranId,
            internal_transaction_id: ipn.transactionId,
            user_id: ipn.userId,
            item_id: ipn.itemId,
            item_type: ipn.itemType,
            amount: ipn.amount,
            status: ipn.status,
            ipn_payload: body,
            processing_status: 'PENDING',
            error_message: null,
            processing_result: null
        });
        if (logResult.success && logResult.data && logResult.data.length > 0) {
            audit.id = logResult.data[0].id;
        }
        console.log('IPN Received:', {
            sslcommerz_tran_id: ipn.sslcommerzTranId,
            user_id: ipn.userId,
            item_id: ipn.itemId,
            amount: ipn.amount,
            payment_type: ipn.itemType,
            transaction_id: ipn.transactionId,
            status: ipn.status
        });

        let validation = null;
        if (ipn.sslcommerzTranId || body.val_id) {
            const checked = await verifyWithGateway(ipn, body, audit);
            if (checked.reply) return checked.reply;
            validation = checked.validation;
        } else {
            console.warn('IPN: No transaction ID provided, cannot validate with SSLCommerz');
            await audit.update({ processing_status: 'UNVALIDATED', error_message: 'No transaction ID provided for validation' });
        }

        if (!validation && ipn.status === 'VALID') {
            // Nothing to check with the gateway, so nothing proves this payment happened.
            const errorMsg = 'Unverified IPN: no transaction ID to validate';
            await audit.update({ processing_status: 'ERROR', error_message: errorMsg });
            return { success: false, error: errorMsg };
        }

        if (ipn.status !== 'VALID' && !(validation && validation.isValid)) {
            // FAILED, CANCELLED, etc.
            await audit.update({ processing_status: 'FAILED', error_message: `Payment status: ${ipn.status}` });
            return { success: false, message: `Payment status: ${ipn.status}` };
        }

        try {
            return await fulfil(ipn, validation, audit);
        } catch (processingError) {
            const errorMsg = processingError.message || 'Payment processing error';
            logger.error('IPN Processing Error:', processingError);
            await audit.update({
                processing_status: 'ERROR',
                error_message: errorMsg,
                processing_result: { error: errorMsg, stack: processingError.stack }
            });
            return { success: false, error: errorMsg };
        }
    } catch (error) {
        logger.error('IPN Endpoint Error:', error);
        if (audit.id) {
            await paymentService.updatePaymentLog(audit.id, {
                processing_status: 'ERROR',
                error_message: error.message || 'Unknown error',
                processing_result: { error: error.message, stack: error.stack }
            }).catch(err => logger.error('Failed to update audit log:', err));
        }
        return { success: false, error: 'Internal server error' };
    }
}

module.exports = { handleIpn, parseIpn };
