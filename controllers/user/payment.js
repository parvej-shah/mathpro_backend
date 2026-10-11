const { getAccessibleCourseIds, checkCourseAccess } = require("../../util/courseAccessHelpers");


const Controller = require("../base").Controller;
const { respond, catchAs, handle } = require('../base');
const { parseLimitOffset } = require('../../util/pagination');
const PaymentService=require("../../service/user/payment.js").PaymentService
const paymentFulfillment = require('../../service/user/paymentFulfillment');

const logger = require('../../util/logger');
const { byPaymentType } = require('../../util/itemTypes');

// SSLCommerz value_d (COURSE / BUNDLE / BOOK) as the Frontend's item type, or null.
const itemKeyOf = (valueD) => byPaymentType(valueD)?.key || null;

// Who may reconcile a logged payment, per item_type: a check (true when allowed) and the 403
// body when not. Types without an entry (books) are not course-scoped.
const RECONCILE_ACCESS = {
    COURSE: {
        allowed: async (userId, courseId) => (await checkCourseAccess(userId, 'payment', 'manage', courseId)).hasAccess,
        denied: { error: 'NO_COURSE_ACCESS', message: 'No access to reconcile payments for this course' },
    },
    BUNDLE: {
        // Access to any course in the bundle is enough; an unknown bundle is not blocked here.
        allowed: async (userId, bundleId) => {
            const { BundleService } = require('../../service/managerial/bundle');
            const bundleResult = await new BundleService().get(bundleId);
            if (!bundleResult.success || !bundleResult.data || bundleResult.data.length === 0) return true;
            const access = await getAccessibleCourseIds(userId, 'payment', 'manage');
            if (access.hasGlobalAccess) return true;
            const courses = bundleResult.data[0].courses || [];
            return courses.some((course) => access.courseIds.includes(course.id));
        },
        denied: { error: 'NO_BUNDLE_ACCESS', message: 'No access to reconcile payments for this bundle' },
    },
};


const paymentService=new PaymentService()

class PaymentController extends Controller {
    constructor() {
        super();
    }
    initiatePayment = handle((req) => paymentService.initiatePayment(req.body,parseInt(req.params.id)))
    initiatePaymentForBundle = handle((req) => paymentService.initiatePaymentForBundle(req.body,parseInt(req.params.id)))
    initiatePaymentForBook = handle((req) => paymentService.initiatePaymentForBook(req.body,parseInt(req.params.id)))
    redirect =async (req,res)=>{
        // console.log(req.query.url)
        return res.redirect(`${req.query.url}/post-payment/${req.params.status}`)
    }

    redirectNew =async (req,res)=>{
      // console.log(req.query.url)
      return res.redirect(`${req.query.url}`)
  }

    // Handle SSLCommerz success callback (POST) and redirect to frontend (GET)
    handlePaymentSuccess = async (req, res) => {
        try {
            // SSLCommerz sends payment data via POST
            // Extract necessary data from the POST body
            const { tran_id, status, value_d } = req.body;
            
            // Item type from value_d; anything unknown is treated as a course
            const type = itemKeyOf(value_d) || 'course';
            const itemId = req.body.value_b; // course_id, bundle_id, or book_id

            // The invoice when SSLCommerz sent a tran_id, else post-payment with ?type=…&<type>Id=…
            const frontendUrl = process.env.FRONTEND_URL || 'https://mathprobd.com';
            const redirectUrl = tran_id
                ? `${frontendUrl}/billing/invoice/${encodeURIComponent(tran_id)}`
                : `${frontendUrl}/post-payment/success?type=${type}&${type}Id=${itemId}`;
            
            console.log('Payment success redirect:', { type, itemId, tran_id, redirectUrl });
            
            // Redirect to frontend (GET request)
            return res.redirect(redirectUrl);
        } catch (error) {
            logger.error('Error in handlePaymentSuccess:', error);
            // Fallback to generic success page
            const frontendUrl = process.env.FRONTEND_URL || 'https://mathprobd.com';
            return res.redirect(`${frontendUrl}/dashboard`); // Redirect to dashboard if something goes wrong (user can see their purchases there)
        }
    }

    // Handle SSLCommerz failure callback (POST) and redirect to frontend (GET)
    handlePaymentFailure = async (req, res) => {
        const frontendUrl = process.env.FRONTEND_URL || 'https://mathprobd.com';
        try {
            const { value_d } = req.body;
            const type = itemKeyOf(value_d);
            const itemId = req.body.value_b; // course_id, bundle_id, or book_id

            const redirectUrl = type && itemId
                ? `${frontendUrl}/post-payment/failure?type=${type}&itemId=${itemId}`
                : `${frontendUrl}/post-payment/failure`;

            return res.redirect(redirectUrl);
        } catch (error) {
            logger.error('Error in handlePaymentFailure:', error);
            return res.redirect(`${frontendUrl}/post-payment/failure`);
        }
    }

    // Handle SSLCommerz cancel callback (POST) and redirect to frontend (GET)
    handlePaymentCancel = async (req, res) => {
        const frontendUrl = process.env.FRONTEND_URL || 'https://mathprobd.com';
        try {
            const { value_d } = req.body;
            const type = itemKeyOf(value_d);
            const itemId = req.body.value_b; // course_id, bundle_id, or book_id

            const redirectUrl = type && itemId
                ? `${frontendUrl}/post-payment/cancel?type=${type}&itemId=${itemId}`
                : `${frontendUrl}/post-payment/cancel`;

            return res.redirect(redirectUrl);
        } catch (error) {
            logger.error('Error in handlePaymentCancel:', error);
            return res.redirect(`${frontendUrl}/post-payment/cancel`);
        }
    }

    // SSLCommerz IPN. Always 200: SSLCommerz expects it even when processing fails.
    ipn = async (req, res) => {
        return res.status(200).json(await paymentFulfillment.handleIpn(req.body));
    }

    getPaymentHistory = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const userId = req.user?.id || req.body.user_id;
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const result = await paymentService.getPaymentHistoryAndEnrollments(userId);
        return respond(res, result);
    })

    // Get payment audit logs (new API - doesn't break existing functionality)
    // Supports both user and admin authentication
    getPaymentAuditLogs = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        // Get accessible course IDs for the current user
        const userId = req.user?.id || req.body.user_id;
        const access = await getAccessibleCourseIds(userId, 'payment', 'manage');

        const filters = {
            user_id: req.query.user_id,
            sslcommerz_tran_id: req.query.sslcommerz_tran_id || req.body.sslcommerz_tran_id,
            internal_transaction_id: req.query.internal_transaction_id || req.body.internal_transaction_id,
            item_type: req.query.item_type || req.body.item_type,
            status: req.query.status || req.body.status,
            processing_status: req.query.processing_status || req.body.processing_status,
            ...parseLimitOffset({
                limit: req.query.limit || req.body.limit,
                offset: req.query.offset || req.body.offset,
            }, { defaultLimit: 100 }),
            accessible_course_ids: access.hasGlobalAccess ? null : access.courseIds
        };

        // Remove undefined/null/empty filters
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
                delete filters[key];
            }
        });

        const result = await paymentService.getPaymentAuditLogs(filters);
        return respond(res, result);
    })

    // Export payment audit logs (returns all matching records without pagination)
    // Admin only - for CSV export functionality
    exportPaymentAuditLogs = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        // Get accessible course IDs for the current user
        const userId = req.user?.id || req.body.user_id;
        const access = await getAccessibleCourseIds(userId, 'payment', 'manage');
        
        // Build filters - ignore limit and offset for export
        const filters = {
            user_id: req.query.user_id,
            sslcommerz_tran_id: req.query.sslcommerz_tran_id || req.body.sslcommerz_tran_id,
            internal_transaction_id: req.query.internal_transaction_id || req.body.internal_transaction_id,
            item_type: req.query.item_type || req.body.item_type,
            status: req.query.status || req.body.status,
            processing_status: req.query.processing_status || req.body.processing_status,
            accessible_course_ids: access.hasGlobalAccess ? null : access.courseIds
        };

        // Remove undefined/null/empty filters
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
                delete filters[key];
            }
        });

        const result = await paymentService.exportPaymentAuditLogs(filters);
        return respond(res, result);
    })

    // Manual reconciliation endpoint (new API - doesn't break existing functionality)
    // Supports both user and admin authentication
    reconcilePayment = catchAs({ success: false, error: 'Internal server error' }, async (req, res) => {
        const sslcommerz_tran_id = req.body.sslcommerz_tran_id || req.params.sslcommerz_tran_id;
        // Support both authenticateUser (req.user.id) and authenticateAdmin (req.body.user_id)
        const reconciled_by = req.user?.id || req.body.user_id || req.body.reconciled_by;
        const notes = req.body.notes || null;

        if (!sslcommerz_tran_id) {
            return res.status(400).json({
                success: false,
                error: 'SSLCommerz transaction ID is required'
            });
        }

        // Check access to the specific transaction
        const logResult = await paymentService.query(
            `SELECT item_id, item_type FROM payment_audit_log WHERE sslcommerz_tran_id = $1 LIMIT 1`,
            [sslcommerz_tran_id]
        );

        if (logResult.success && logResult.data && logResult.data.length > 0) {
            const { item_id, item_type } = logResult.data[0];
            const rule = Object.prototype.hasOwnProperty.call(RECONCILE_ACCESS, item_type) ? RECONCILE_ACCESS[item_type] : null;
            if (rule && !(await rule.allowed(reconciled_by, item_id))) {
                return res.status(403).json({ success: false, ...rule.denied });
            }
        }


        if (!reconciled_by) {
            return res.status(400).json({
                success: false,
                error: 'Reconciled by (user ID) is required'
            });
        }

        // Enrols from what SSLCommerz confirms (not the audit log) and sends the purchase
        // confirmation when it enrolled.
        const result = await paymentFulfillment.reconcile(sslcommerz_tran_id, reconciled_by, notes);
        return respond(res, result);
    })
}

module.exports={PaymentController}
