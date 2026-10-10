const { getAccessibleCourseIds, checkCourseAccess } = require("../../util/courseAccessHelpers");


const Controller = require("../base").Controller;
const { respond, catchAs } = require('../base');
const PaymentService=require("../../service/user/payment.js").PaymentService
const paymentFulfillment = require('../../service/user/paymentFulfillment');

const MessagingService=require('../../service/messagingService.js').MessagingService
const logger = require('../../util/logger');


const paymentService=new PaymentService()
const messagingService=new MessagingService()

class PaymentController extends Controller {
    constructor() {
        super();
    }
    initiatePayment =async (req,res)=>{
        var result=await paymentService.initiatePayment(req.body,parseInt(req.params.id))
        return respond(res, result)
    }
    initiatePaymentForBundle =async (req,res)=>{
      var result=await paymentService.initiatePaymentForBundle(req.body,parseInt(req.params.id))
      return respond(res, result)
    }
    initiatePaymentForBook =async (req,res)=>{
      var result=await paymentService.initiatePaymentForBook(req.body,parseInt(req.params.id))
      return respond(res, result)
    }
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
            
            // Determine the type from value_d (COURSE, BUNDLE, or BOOK)
            const type = value_d === 'BUNDLE' ? 'bundle' : value_d === 'BOOK' ? 'book' : 'course';
            const itemId = req.body.value_b; // course_id, bundle_id, or book_id

            // Build frontend URL with query parameters
            const frontendUrl = process.env.FRONTEND_URL || 'https://mathpro.academy';
            let redirectUrl;

            if (type === 'bundle') {
                redirectUrl = tran_id
                    ? `${frontendUrl}/billing/invoice/${encodeURIComponent(tran_id)}`
                    : `${frontendUrl}/post-payment/success?type=bundle&bundleId=${itemId}`;
            } else if (type === 'book') {
                redirectUrl = tran_id
                    ? `${frontendUrl}/billing/invoice/${encodeURIComponent(tran_id)}`
                    : `${frontendUrl}/post-payment/success?type=book&bookId=${itemId}`;
            } else {
                redirectUrl = tran_id
                    ? `${frontendUrl}/billing/invoice/${encodeURIComponent(tran_id)}`
                    : `${frontendUrl}/post-payment/success?type=course&courseId=${itemId}`;
            }
            
            console.log('Payment success redirect:', { type, itemId, tran_id, redirectUrl });
            
            // Redirect to frontend (GET request)
            return res.redirect(redirectUrl);
        } catch (error) {
            logger.error('Error in handlePaymentSuccess:', error);
            // Fallback to generic success page
            const frontendUrl = process.env.FRONTEND_URL || 'https://mathpro.academy';
            return res.redirect(`${frontendUrl}/dashboard`); // Redirect to dashboard if something goes wrong (user can see their purchases there)
        }
    }

    // Handle SSLCommerz failure callback (POST) and redirect to frontend (GET)
    handlePaymentFailure = async (req, res) => {
        const frontendUrl = process.env.FRONTEND_URL || 'https://mathpro.academy';
        try {
            const { value_d } = req.body;
            const type = value_d === 'BUNDLE' ? 'bundle' : value_d === 'BOOK' ? 'book' : value_d === 'COURSE' ? 'course' : null;
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
        const frontendUrl = process.env.FRONTEND_URL || 'https://mathpro.academy';
        try {
            const { value_d } = req.body;
            const type = value_d === 'BUNDLE' ? 'bundle' : value_d === 'BOOK' ? 'book' : value_d === 'COURSE' ? 'course' : null;
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
            limit: parseInt(req.query.limit || req.body.limit || 100),
            offset: parseInt(req.query.offset || req.body.offset || 0),
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
            
            if (item_type === 'COURSE') {
                const access = await checkCourseAccess(reconciled_by, 'payment', 'manage', item_id);
                if (!access.hasAccess) {
                    return res.status(403).json({
                        success: false,
                        error: 'NO_COURSE_ACCESS',
                        message: 'No access to reconcile payments for this course'
                    });
                }
            } else if (item_type === 'BUNDLE') {
                // Check if user has access to ANY course in the bundle
                const { BundleService } = require('../../service/managerial/bundle');
                const bundleService = new BundleService();
                const bundleResult = await bundleService.get(item_id);
                
                if (bundleResult.success && bundleResult.data && bundleResult.data.length > 0) {
                    const courses = bundleResult.data[0].courses || [];
                    let hasAnyAccess = false;
                    
                    // If user has global access, they're good
                    const globalAccess = await getAccessibleCourseIds(reconciled_by, 'payment', 'manage');
                    if (globalAccess.hasGlobalAccess) {
                        hasAnyAccess = true;
                    } else {
                        // Check individual courses
                        for (const course of courses) {
                            if (globalAccess.courseIds.includes(course.id)) {
                                hasAnyAccess = true;
                                break;
                            }
                        }
                    }
                    
                    if (!hasAnyAccess) {
                        return res.status(403).json({
                            success: false,
                            error: 'NO_BUNDLE_ACCESS',
                            message: 'No access to reconcile payments for this bundle'
                        });
                    }
                }
            }
        }


        if (!reconciled_by) {
            return res.status(400).json({
                success: false,
                error: 'Reconciled by (user ID) is required'
            });
        }

        const result = await paymentService.reconcilePayment(sslcommerz_tran_id, reconciled_by, notes);
        
        // CRITICAL: Send notifications after successful reconciliation (non-blocking)
        // Only send if enrollment succeeded
        if (result.success && result.data && result.data.enrollment_succeeded) {
            try {
                // Get payment log to get user and item details
                // Note: There can be multiple entries for same transaction (multiple IPN callbacks)
                // Find the VALID entry or use the most recent one
                const logResult = await paymentService.query(
                    `SELECT * FROM payment_audit_log WHERE sslcommerz_tran_id = $1 ORDER BY timestamp DESC`,
                    [sslcommerz_tran_id]
                );
                
                if (logResult.success && logResult.data && logResult.data.length > 0) {
                    // Find VALID entry if exists, otherwise use most recent
                    const validLog = logResult.data.find(entry => entry.status === 'VALID');
                    const log = validLog || logResult.data[0];
                    const userId = log.user_id;
                    const itemId = log.item_id;
                    const itemType = log.item_type;
                    const transactionId = log.internal_transaction_id || 
                        paymentService.generateTransactionId(userId, itemId);
                    
                    // Get user and item details for notifications
                    const dbResults = await Promise.all([
                        paymentService.query(`SELECT * FROM managerial_auth WHERE id = $1`, [userId]),
                        itemType === 'BUNDLE' 
                            ? paymentService.query(`SELECT * FROM bundle WHERE id = $1`, [itemId])
                            : paymentService.query(`SELECT * FROM course WHERE id = $1`, [itemId])
                    ]);
                    
                    if (dbResults[0].success && dbResults[0].data && dbResults[0].data.length > 0 &&
                        dbResults[1].success && dbResults[1].data && dbResults[1].data.length > 0) {
                        
                        const user = dbResults[0].data[0];
                        const userPhone = user.login || user.phone;
                        const userEmail = user.profile?.email || user.email;
                        const frontendUrl = process.env.FRONTEND_URL || 'https://mathpro.academy';
                        
                        if (itemType === 'BUNDLE') {
                            const bundle = dbResults[1].data[0];
                            const bundleTitle = bundle.title;
                            const bundleId = bundle.id;
                            
                            // Get bundle with courses for email
                            const { BundleService } = require('../../service/managerial/bundle');
                            const bundleService = new BundleService();
                            const bundleWithCourses = await bundleService.get(bundleId);
                            const courseCount = bundleWithCourses.success && bundleWithCourses.data && bundleWithCourses.data.length > 0
                                ? (bundleWithCourses.data[0].courses ? bundleWithCourses.data[0].courses.length : 0)
                                : 0;
                            
                            const successUrl = `${frontendUrl}/billing/invoice/${encodeURIComponent(transactionId)}`;
                            const dashboardUrl = `${frontendUrl}/dashboard`;
                            const text = `Dear ${user.name}, you have successfully purchased the "${bundleTitle}" bundle from Math Pro! You are now enrolled in ${courseCount} courses. Your access code is: ${transactionId}. View dashboard: ${dashboardUrl}`;
                            
                            const emailText = `<!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Bundle Purchase Success</title>
                                  <style>
                                    body { font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #333; }
                                    .container { background-color: #ffffff; width: 100%; max-width: 620px; margin: 40px auto; padding: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); border-radius: 8px; border-top: 3px solid #007bff; }
                                    .header { background: linear-gradient(to right, #0062E6, #33AEFF); color: #ffffff; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
                                    .content { padding: 20px; line-height: 1.6; }
                                    .content h3 { color: #0062E6; }
                                    .center { text-align: center; }
                                    .info-button { background-color: #007bff; display: inline-block; padding: 12px 25px; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 5px; }
                                    .button-group { text-align: center; margin: 25px 0; }
                                    .footer { margin-top: 20px; text-align: center; font-size: 14px; color: #666; }
                                  </style>
                                </head>
                                <body>
                                  <div class="container">
                                    <div class="header"><h2>অভিনন্দন! Bundle Purchase Successful!</h2></div>
                                    <div class="content">
                                      <p class="center">Dear <strong>${user.name}</strong>, you have successfully purchased the <strong>${bundleTitle}</strong> bundle from Math Pro!</p>
                                      <p class="center">Your access code is: <strong>${transactionId}</strong></p>
                                      <p class="center">আর তোমাকে সর্বাত্নক হেল্প করতে পাশে আছি <strong>আমরা কোডার ভাই পরিবার!</strong></p>
                                      <div class="button-group">
                                        <a href="${successUrl}" class="info-button">📋 View Important Info & Next Steps</a>
                                      </div>
                                    </div>
                                    <div class="footer">
                                      <p>This is an automated message. Please do not reply directly to this email.</p>
                                    </div>
                                  </div>
                                </body>
                                </html>`;
                            
                            // Send notifications (non-blocking)
                            if (userPhone || userEmail) {
                                Promise.all([
                                    userPhone ? messagingService.sendMessage(userPhone, text).catch(err => {
                                        logger.error('Reconciliation: Bundle SMS send error:', err);
                                        return { success: false };
                                    }) : Promise.resolve({ success: false, error: 'No phone' }),
                                    userEmail ? messagingService.sendMail(userEmail, 'Bundle Purchase Confirmation | Math Pro', emailText).catch(err => {
                                        logger.error('Reconciliation: Bundle Email send error:', err);
                                        return { success: false };
                                    }) : Promise.resolve({ success: false, error: 'No email' })
                                ]).then(() => {
                                    console.log('Reconciliation: Notifications sent for bundle purchase');
                                }).catch(err => {
                                    logger.error('Reconciliation: Notification error:', err);
                                });
                            }
                        } else {
                            // Course purchase
                            const course = dbResults[1].data[0];
                            const courseTitle = course.title;
                            const courseId = course.id;
                            
                            const successUrl = `${frontendUrl}/billing/invoice/${encodeURIComponent(transactionId)}`;
                            const dashboardUrl = `${frontendUrl}/dashboard/${courseId}`;
                            const text = `Dear ${user.name}, you have successfully purchased "${courseTitle}" course from Math Pro. Your access code is: ${transactionId}. Start learning: ${dashboardUrl}`;
                            
                            const emailText = `<!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Course Purchase Success</title>
                                  <style>
                                    body { font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #333; }
                                    .container { background-color: #ffffff; width: 100%; max-width: 620px; margin: 40px auto; padding: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); border-radius: 8px; border-top: 3px solid #007bff; }
                                    .header { background: linear-gradient(to right, #0062E6, #33AEFF); color: #ffffff; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
                                    .content { padding: 20px; line-height: 1.6; }
                                    .center { text-align: center; }
                                    .info-button { background-color: #007bff; display: inline-block; padding: 12px 25px; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 5px; }
                                    .button-group { text-align: center; margin: 25px 0; }
                                    .footer { margin-top: 20px; text-align: center; font-size: 14px; color: #666; }
                                  </style>
                                </head>
                                <body>
                                  <div class="container">
                                    <div class="header"><h2>অভিনন্দন! Course Purchase Successful!</h2></div>
                                    <div class="content">
                                      <p class="center">Dear <strong>${user.name}</strong>, you have successfully purchased <strong>${courseTitle}</strong> course from Math Pro!</p>
                                      <p class="center">Your access code is: <strong>${transactionId}</strong></p>
                                      <p class="center">আর তোমাকে সর্বাত্নক হেল্প করতে পাশে আছি <strong>আমরা কোডার ভাই পরিবার!</strong></p>
                                      <div class="button-group">
                                        <a href="${successUrl}" class="info-button">📋 View Important Info & Next Steps</a>
                                      </div>
                                    </div>
                                    <div class="footer">
                                      <p>This is an automated message. Please do not reply directly to this email.</p>
                                    </div>
                                  </div>
                                </body>
                                </html>`;
                            
                            // Send notifications (non-blocking)
                            if (userPhone || userEmail) {
                                Promise.all([
                                    userPhone ? messagingService.sendMessage(userPhone, text).catch(err => {
                                        logger.error('Reconciliation: Course SMS send error:', err);
                                        return { success: false };
                                    }) : Promise.resolve({ success: false, error: 'No phone' }),
                                    userEmail ? messagingService.sendMail(userEmail, 'Course Purchased Confirmation | Math Pro', emailText).catch(err => {
                                        logger.error('Reconciliation: Course Email send error:', err);
                                        return { success: false };
                                    }) : Promise.resolve({ success: false, error: 'No email' })
                                ]).then(() => {
                                    console.log('Reconciliation: Notifications sent for course purchase');
                                }).catch(err => {
                                    logger.error('Reconciliation: Notification error:', err);
                                });
                            }
                        }
                    }
                }
            } catch (notificationError) {
                // CRITICAL: Never fail reconciliation due to notification errors
                logger.error('Reconciliation: Error sending notifications (non-critical):', notificationError);
            }
        }
        
        return respond(res, result);
    })
}

module.exports={PaymentController}
