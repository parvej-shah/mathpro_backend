const { logNames } = require("../../util/constants.js");
const { getAccessibleCourseIds, checkCourseAccess } = require("../../util/courseAccessHelpers");


const Controller = require("../base").Controller;
const PaymentService=require("../../service/user/payment.js").PaymentService
const CourseService=require("../../service/managerial/course").CourseService

const MessagingService=require('../../service/messagingService.js').MessagingService


const paymentService=new PaymentService()
const courseService=new CourseService()
const messagingService=new MessagingService()

class PaymentController extends Controller {
    constructor() {
        super();
    }
    initiatePayment =async (req,res)=>{
        var result=await paymentService.initiatePayment(req.body,parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }
    initiatePaymentForBundle =async (req,res)=>{
      var result=await paymentService.initiatePaymentForBundle(req.body,parseInt(req.params.id))
      return res.status(result.success?200:400).json(result)
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
            
            // Determine the type from value_d (COURSE or BUNDLE)
            const type = value_d === 'BUNDLE' ? 'bundle' : 'course';
            const itemId = req.body.value_b; // course_id or bundle_id
            
            // Build frontend URL with query parameters
            const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
            let redirectUrl;
            
            if (type === 'bundle') {
                redirectUrl = tran_id
                    ? `${frontendUrl}/billing/invoice/${encodeURIComponent(tran_id)}`
                    : `${frontendUrl}/post-payment/success?type=bundle&bundleId=${itemId}`;
            } else {
                redirectUrl = tran_id
                    ? `${frontendUrl}/billing/invoice/${encodeURIComponent(tran_id)}`
                    : `${frontendUrl}/post-payment/success?type=course&courseId=${itemId}`;
            }
            
            console.log('Payment success redirect:', { type, itemId, tran_id, redirectUrl });
            
            // Redirect to frontend (GET request)
            return res.redirect(redirectUrl);
        } catch (error) {
            console.error('Error in handlePaymentSuccess:', error);
            // Fallback to generic success page
            const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
            return res.redirect(`${frontendUrl}/dashboard`); // Redirect to dashboard if something goes wrong (user can see their purchases there)
        }
    }

    // Handle SSLCommerz failure callback (POST) and redirect to frontend (GET)
    handlePaymentFailure = async (req, res) => {
        try {
            const { tran_id } = req.body;
            const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
            let redirectUrl = `${frontendUrl}/post-payment/failure`;
            
            return res.redirect(redirectUrl);
        } catch (error) {
            console.error('Error in handlePaymentFailure:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
            return res.redirect(`${frontendUrl}/post-payment/failure`);
        }
    }

    // Handle SSLCommerz cancel callback (POST) and redirect to frontend (GET)
    handlePaymentCancel = async (req, res) => {
        try {
            const { tran_id } = req.body;
            const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
            let redirectUrl = `${frontendUrl}/post-payment/cancel`;
            
            return res.redirect(redirectUrl);
        } catch (error) {
            console.error('Error in handlePaymentCancel:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
            return res.redirect(`${frontendUrl}/post-payment/cancel`);
        }
    }

    generateUniqueString=(userId, courseId)=> {
        const idString = userId.toString() + courseId.toString();
        const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
        const remainingLength = 20 - idString.length;
        let uniqueString = ''
        for (let i = 0; i < remainingLength; i++) {
          const randomIndex = Math.floor(Math.random() * characters.length);
          uniqueString += characters[randomIndex];
        }  
        uniqueString+=idString
        return uniqueString;
    }
    ipn = async (req, res) => {
        let auditLogId = null;
        const sslcommerzTranId = req.body.tran_id || req.body.transaction_id || null;
        
        try {
            // Validate required fields
            if (!req.body.status) {
                console.error('IPN: Missing status field', req.body);
                // Log the attempt
                await paymentService.logPaymentAttempt({
                    sslcommerz_tran_id: sslcommerzTranId,
                    status: 'INVALID',
                    ipn_payload: req.body,
                    processing_status: 'ERROR',
                    error_message: 'Missing status field'
                });
                return res.status(200).json({ success: false, error: 'Missing status field' });
            }

            const status = req.body.status;
            const userId = req.body.value_a ? parseInt(req.body.value_a) : null;
            // Extract itemId from value_b - handle both string and number formats
            let itemId = null;
            if (req.body.value_b !== undefined && req.body.value_b !== null) {
                const parsed = parseInt(req.body.value_b);
                itemId = isNaN(parsed) ? null : parsed;
            }
            let amount = req.body.value_c ? parseFloat(req.body.value_c) : null; // Changed to 'let' so it can be reassigned with validated amount
            const itemType = req.body.value_d || (itemId ? 'COURSE' : null); // Default to COURSE if not specified
            
            // Log extraction for debugging
            console.log('IPN Data Extraction:', {
                value_a: req.body.value_a,
                value_b: req.body.value_b,
                value_c: req.body.value_c,
                value_d: req.body.value_d,
                extracted_userId: userId,
                extracted_itemId: itemId,
                extracted_amount: amount,
                extracted_itemType: itemType
            });

            // Determine transaction ID:
            // 1. If tran_id from SSLCommerz is NOT "REF123" (old hardcoded value), use it (it's our generated transaction_id)
            // 2. If tran_id is "REF123" or missing, generate new one (backward compatibility for old payments)
            let transactionId = null;
            if (sslcommerzTranId && sslcommerzTranId !== 'REF123') {
                // New flow: tran_id from SSLCommerz is our generated transaction_id (access code)
                transactionId = sslcommerzTranId;
                console.log('IPN: Using transaction_id from SSLCommerz (new flow):', transactionId);
            } else if (userId && itemId) {
                // Old flow: Generate transaction_id (backward compatibility)
                transactionId = this.generateUniqueString(userId, itemId);
                console.log('IPN: Generated transaction_id (backward compatibility):', transactionId);
            }

            // Log the IPN attempt
            const logResult = await paymentService.logPaymentAttempt({
                sslcommerz_tran_id: sslcommerzTranId,
                internal_transaction_id: transactionId,
                user_id: userId,
                item_id: itemId,
                item_type: itemType,
                amount: amount,
                status: status,
                ipn_payload: req.body,
                processing_status: 'PENDING',
                error_message: null,
                processing_result: null
            });

            if (logResult.success && logResult.data && logResult.data.length > 0) {
                auditLogId = logResult.data[0].id;
            }

            console.log('IPN Received:', {
                sslcommerz_tran_id: sslcommerzTranId,
                user_id: userId,
                item_id: itemId,
                amount: amount,
                payment_type: itemType,
                transaction_id: transactionId,
                status: status
            });

            // CRITICAL: Validate transaction with SSLCommerz Order Validation API
            // This is REQUIRED by SSLCommerz documentation to prevent fraud
            // Documentation: https://developer.sslcommerz.com/doc/v4/
            let validationResult = null;
            if (sslcommerzTranId || req.body.val_id) {
                console.log('Validating transaction with SSLCommerz...', {
                    tran_id: sslcommerzTranId,
                    val_id: req.body.val_id
                });
                
                validationResult = await paymentService.validateTransactionWithSSLCommerz(
                    sslcommerzTranId,
                    req.body.val_id || null,
                    req.body.sessionkey || null
                );

                console.log('SSLCommerz Validation Result:', {
                    success: validationResult.success,
                    isValid: validationResult.isValid,
                    status: validationResult.status,
                    risk_level: validationResult.risk_level,
                    amount: validationResult.amount
                });

                // Update audit log with validation result
                if (auditLogId) {
                    await paymentService.updatePaymentLog(auditLogId, {
                        processing_status: 'VALIDATING',
                        processing_result: {
                            validation_attempted: true,
                            validation_success: validationResult.success,
                            validation_result: validationResult
                        }
                    });
                }

                // Check if validation failed
                if (!validationResult.success) {
                    const errorMsg = `SSLCommerz validation failed: ${validationResult.error}`;
                    console.error('IPN Validation Error:', errorMsg);
                    
                    if (auditLogId) {
                        await paymentService.updatePaymentLog(auditLogId, {
                            processing_status: 'ERROR',
                            error_message: errorMsg,
                            processing_result: validationResult
                        });
                    }
                    
                    return res.status(200).json({ 
                        success: false, 
                        error: errorMsg,
                        validation_error: validationResult.error
                    });
                }

                // Check if transaction is valid
                if (!validationResult.isValid) {
                    const errorMsg = validationResult.error || `Transaction status: ${validationResult.status}`;
                    console.error('IPN: Transaction not valid:', errorMsg);
                    
                    if (auditLogId) {
                        await paymentService.updatePaymentLog(auditLogId, {
                            processing_status: 'FAILED',
                            error_message: errorMsg,
                            processing_result: validationResult
                        });
                    }
                    
                    return res.status(200).json({ 
                        success: false, 
                        error: errorMsg,
                        transaction_status: validationResult.status
                    });
                }

                // Check if already processed (VALIDATED status)
                if (validationResult.isAlreadyProcessed) {
                    console.log('IPN: Transaction already processed (VALIDATED status)');
                    
                    if (auditLogId) {
                        await paymentService.updatePaymentLog(auditLogId, {
                            processing_status: 'ALREADY_PROCESSED',
                            error_message: 'Transaction was already validated and processed',
                            processing_result: validationResult
                        });
                    }
                    
                    return res.status(200).json({ 
                        success: true, 
                        message: 'Transaction already processed',
                        already_processed: true
                    });
                }

                // Check risk level (0 = safe, 1 = risky)
                if (validationResult.risk_level === 1) {
                    console.warn('IPN: RISKY PAYMENT DETECTED!', {
                        risk_title: validationResult.risk_title,
                        risk_level: validationResult.risk_level,
                        tran_id: sslcommerzTranId
                    });
                    
                    // Log as risky but still process (merchant decision)
                    // You can modify this to reject risky payments if needed
                    if (auditLogId) {
                        await paymentService.updatePaymentLog(auditLogId, {
                            processing_status: 'RISKY',
                            error_message: `Risky payment detected: ${validationResult.risk_title || 'High risk'}`,
                            processing_result: validationResult
                        });
                    }
                }

                // Verify amount and adopt the validated amount from SSLCommerz.
                // The validated amount is authoritative; enforce it whenever it is
                // present, regardless of whether the IPN body carried value_c (a
                // forged/legacy IPN can omit value_c, and we must not skip the check).
                if (validationResult.amount) {
                    if (amount) {
                        const amountDiff = Math.abs(parseFloat(amount) - validationResult.amount);
                        if (amountDiff > 0.01) { // Allow 0.01 BDT difference for rounding
                            const errorMsg = `Amount mismatch: IPN amount (${amount}) != Validated amount (${validationResult.amount})`;
                            console.error('IPN Amount Mismatch:', errorMsg);

                            if (auditLogId) {
                                await paymentService.updatePaymentLog(auditLogId, {
                                    processing_status: 'ERROR',
                                    error_message: errorMsg,
                                    processing_result: validationResult
                                });
                            }

                            return res.status(200).json({
                                success: false,
                                error: errorMsg,
                                ipn_amount: amount,
                                validated_amount: validationResult.amount
                            });
                        }
                    }

                    // Use validated amount from SSLCommerz (more reliable)
                    amount = validationResult.amount;
                }
            } else {
                console.warn('IPN: No transaction ID provided, cannot validate with SSLCommerz');
                // Still log but mark as unvalidated
                if (auditLogId) {
                    await paymentService.updatePaymentLog(auditLogId, {
                        processing_status: 'UNVALIDATED',
                        error_message: 'No transaction ID provided for validation'
                    });
                }
            }

            // Only process if status is VALID (or if validation passed)
            if (status === 'VALID' || (validationResult && validationResult.isValid)) {
                try {
                    // SIMPLIFIED: Just get couponId from tracking data (if exists)
                    // Coupon usage was already recorded during payment initiation with status='pending'
                    // We just need to update it to 'completed' after payment succeeds
                    let couponId = null;
                    
                    try {
                        const CouponService = require('../../service/managerial/coupon');
                        const couponService = new CouponService();
                        
                        // Get coupon tracking data to find couponId
                        const trackingResult = await couponService.getPaymentCouponData(transactionId);
                        if (trackingResult.success && trackingResult.data) {
                            couponId = trackingResult.data.coupon_id;
                            console.log('IPN: Found coupon for transaction:', {
                                transactionId,
                                couponId
                            });
                        }
                    } catch (couponError) {
                        console.error('IPN: Error getting coupon data (non-critical):', couponError);
                        // Don't fail payment if coupon lookup fails
                    }
                    
                    if (itemType === 'BUNDLE') {
                        // Handle bundle purchase
                        const { BundleService } = require('../../service/managerial/bundle');
                        const bundleService = new BundleService();
                        
                        const purchaseResult = await bundleService.purchaseBundle(userId, itemId, amount, transactionId);
                        
                        // CRITICAL FIX: Update coupon usage status from 'pending' to 'completed'
                        // Always attempt update using transactionId (doesn't require couponId)
                        // This ensures status is updated even if tracking data lookup failed
                        try {
                            const CouponService = require('../../service/managerial/coupon');
                            const couponService = new CouponService();
                            
                            const updateResult = await couponService.updateCouponUsageStatus(transactionId, 'completed');
                            if (updateResult.success) {
                                if (updateResult.data && updateResult.data.length > 0) {
                                    console.log('IPN: ✅ Bundle coupon usage status updated to completed', {
                                        transactionId,
                                        couponId: couponId || 'unknown',
                                        updatedCount: updateResult.data.length
                                    });
                                } else {
                                    // EDGE CASE: No record found or already updated
                                    // This is OK - might not have coupon or already updated
                                    console.log('IPN: Bundle coupon usage record not found or already updated (non-critical):', {
                                        transactionId,
                                        couponId: couponId || 'unknown',
                                        message: updateResult.message
                                    });
                                }
                            } else {
                                console.warn('IPN: ⚠️ Failed to update bundle coupon usage status (non-critical):', {
                                    transactionId,
                                    couponId: couponId || 'unknown',
                                    error: updateResult.error
                                });
                            }
                        } catch (couponError) {
                            console.error('IPN: Error updating bundle coupon usage status (non-critical):', {
                                transactionId,
                                couponId: couponId || 'unknown',
                                error: couponError.message,
                                stack: couponError.stack
                            });
                            // Don't fail payment if coupon update fails
                        }
                        
                        if (purchaseResult.success) {
                            // Fulfil any optional physical books included with this bundle
                            try {
                                const bookFulfil = await paymentService.fulfilBookSelection(transactionId);
                                if (bookFulfil.fulfilled > 0) {
                                    console.log('IPN: ✅ Bundle book purchase(s) recorded', {
                                        transactionId,
                                        fulfilled: bookFulfil.fulfilled
                                    });
                                }
                            } catch (bookError) {
                                console.error('IPN: Error fulfilling bundle book selection (non-critical):', {
                                    transactionId,
                                    error: bookError.message
                                });
                                // Don't fail the payment if book fulfilment fails; admin can reconcile
                            }

                            // Get user and bundle details for notification
                            const dbResults = await Promise.all([
                                paymentService.query(
                                    `select * from managerial_auth where id = $1`,
                                    [userId]
                                ),
                                paymentService.query(
                                    `select * from bundle where id = $1`,
                                    [itemId]
                                ),
                                bundleService.get(itemId) // Get bundle with courses
                            ]);
                            
                            // Send notifications if we have the required data
                            // CRITICAL: Payment already succeeded, so notifications are non-blocking
                            // If database queries fail, we skip notifications but payment still succeeds
                            if (dbResults[0].success && dbResults[0].data && dbResults[0].data.length > 0 &&
                                dbResults[1].success && dbResults[1].data && dbResults[1].data.length > 0 &&
                                dbResults[2].success && dbResults[2].data && dbResults[2].data.length > 0) {
                                
                                try {
                                    const user = dbResults[0].data[0];
                                    const bundle = dbResults[1].data[0];
                                    const bundleWithCourses = dbResults[2].data[0];
                                    
                                    // Get bundleId from database result (same as email uses - this is the working standard)
                                    let bundleId = dbResults[1].data[0].id;
                                    
                                    // CRITICAL: Ensure bundleId is a valid number (not null/undefined)
                                    if (!bundleId || isNaN(bundleId)) {
                                        // Fallback to itemId as last resort
                                        bundleId = itemId;
                                    }
                                    
                                    const bundleTitle = bundle.title;
                                    const courseCount = bundleWithCourses.courses ? bundleWithCourses.courses.length : 0;
                                    
                                    const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
                                    
                                    const successUrl = `${frontendUrl}/billing/invoice/${encodeURIComponent(transactionId)}`;
                                    
                                    // SMS: Use main dashboard link for bundle (shows all courses)
                                    const dashboardUrl = `${frontendUrl}/dashboard`;
                                    
                                    const text = `Dear ${user.name}, you have successfully purchased the "${bundleTitle}" bundle from Math Pro! You are now enrolled in ${courseCount} courses. Your access code is: ${transactionId}. View dashboard: ${dashboardUrl}`;
                                
                                const emailText = `<!DOCTYPE html>
                                <html lang="en">
                                
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Bundle Purchase Success</title>
                                  <style>
                                    body {
                                      font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                      margin: 0;
                                      padding: 0;
                                      background-color: #f4f4f4;
                                      color: #333;
                                    }
                                
                                    .container {
                                      background-color: #ffffff;
                                      width: 100%;
                                      max-width: 620px;
                                      margin: 40px auto;
                                      padding: 20px;
                                      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                                      border-radius: 8px;
                                      border-top: 3px solid #007bff;
                                    }
                                
                                    .header {
                                      background: linear-gradient(to right, #0062E6, #33AEFF);
                                      color: #ffffff;
                                      padding: 20px;
                                      border-radius: 5px 5px 0 0;
                                      text-align: center;
                                    }
                                
                                    .content {
                                      padding: 20px;
                                      line-height: 1.6;
                                    }
                                
                                    .content h3 {
                                      color: #0062E6;
                                    }
                                
                                    .content p,
                                    .content ul {
                                      margin: 10px 0;
                                    }
                                    
                                    .center { text-align: center; }
                                
                                    .content ul {
                                      list-style: inside square;
                                    }
                                
                                    .button,
                                    .fb-group-button {
                                      display: inline-block;
                                      padding: 12px 25px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      border-radius: 5px;
                                      font-weight: bold;
                                      transition: background-color 0.3s ease;
                                      margin-top: 10px;
                                    }
                                
                                    .button {
                                      background-color: #28a745;
                                    }
                                
                                    .button:hover {
                                      background-color: #218838;
                                    }
                                
                                    .fb-group-button {
                                      background-color: #3b5998;
                                    }
                                
                                    .fb-group-button:hover {
                                      background-color: #333c8c;
                                    }
                                
                                    .info-button {
                                      background-color: #007bff;
                                      display: inline-block;
                                      padding: 12px 25px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      border-radius: 5px;
                                      font-weight: bold;
                                      transition: background-color 0.3s ease;
                                      margin: 10px 5px;
                                    }
                                
                                    .info-button:hover {
                                      background-color: #0056b3;
                                    }
                                
                                    .button-group {
                                      text-align: center;
                                      margin: 25px 0;
                                    }
                                
                                    .footer {
                                      margin-top: 20px;
                                      text-align: center;
                                      font-size: 14px;
                                      color: #666;
                                    }
                                    
                                    .course-list {
                                      background-color: #f8f9fa;
                                      padding: 15px;
                                      border-radius: 5px;
                                      margin: 15px 0;
                                    }
                                  </style>
                                </head>
                                
                                <body>
                                  <div class="container">
                                    <div class="header">
                                      <h2>অভিনন্দন! Bundle Purchase Successful!</h2>
                                    </div>
                                    <div class="content">
                                      <p class="center">Dear <strong>${user.name}</strong>, you have successfully purchased the <strong>${bundleTitle}</strong> bundle from Math Pro!</p>
                                      
                                      ${bundleWithCourses.courses && bundleWithCourses.courses.length > 0 ? `
                                      <div class="course-list">
                                        <h3>You are now enrolled in these courses:</h3>
                                        <ul>
                                          ${bundleWithCourses.courses.map(course => `<li>${course.title}</li>`).join('')}
                                        </ul>
                                      </div>
                                      ` : ''}
                                      
                                      <p class="center">Your access code is: <strong>${transactionId}</strong></p>
                                      <p class="center">আর তোমাকে সর্বাত্নক হেল্প করতে পাশে আছি <strong>আমরা কোডার ভাই পরিবার!</strong></p>
                                      
                                      <div class="button-group">
                                        <a href="${successUrl}" class="info-button">📋 View Important Info & Next Steps</a>
                                      </div>
                                    </div>
                                    <div class="footer">
                                      <p>This is an automated message. Please do not reply directly to this email.</p>
                                      <p style="margin-top: 10px;">
                                        <a href="${successUrl}" style="color: #007bff; text-decoration: underline;">Click here to see important information about your purchase</a>
                                      </p>
                                    </div>
                                  </div>
                                </body>
                                
                                </html>`;
                                
                                    // CRITICAL FIX: Send notifications with proper error handling and logging
                                    // Check if user has valid contact info before sending
                                    const userPhone = user.login || user.phone;
                                    const userEmail = user.profile?.email || user.email;
                                    
                                    if (!userPhone && !userEmail) {
                                        console.warn('IPN: Cannot send notifications - user has no phone or email:', {
                                            userId,
                                            transactionId,
                                            bundleId
                                        });
                                    } else {
                                        // Send notifications (don't await - let them run in background)
                                        // CRITICAL: Wrapped in try-catch to ensure payment never fails due to notification errors
                                        Promise.all([
                                            userPhone ? messagingService.sendMessage(userPhone, text).catch(err => {
                                                console.error('IPN: Bundle SMS send error:', {
                                                    userId,
                                                    transactionId,
                                                    phone: userPhone,
                                                    error: err.message
                                                });
                                                return { success: false, error: err.message };
                                            }) : Promise.resolve({ success: false, error: 'No phone number' }),
                                            userEmail ? messagingService.sendMail(userEmail, 'Bundle Purchase Confirmation | Math Pro', emailText).catch(err => {
                                                console.error('IPN: Bundle Email send error:', {
                                                    userId,
                                                    transactionId,
                                                    email: userEmail,
                                                    error: err.message
                                                });
                                                return { success: false, error: err.message };
                                            }) : Promise.resolve({ success: false, error: 'No email address' }),
                                            courseService.createLog(logNames.coursePurchase, {
                                                user_id: userId,
                                                course_id: itemId,
                                                amount: amount,
                                                type: 'bundle'
                                            }).catch(err => console.error('IPN: Log creation error:', err))
                                        ]).then(results => {
                                            console.log('IPN: Bundle notifications sent:', {
                                                userId,
                                                transactionId,
                                                bundleId,
                                                sms: results[0]?.success ? 'sent' : 'failed',
                                                email: results[1]?.success ? 'sent' : 'failed'
                                            });
                                        }).catch(err => {
                                            console.error('IPN: Bundle notification error:', {
                                                userId,
                                                transactionId,
                                                bundleId,
                                                error: err.message,
                                                stack: err.stack
                                            });
                                        });
                                    }
                                } catch (notificationError) {
                                    // CRITICAL: Never let notification errors break payment processing
                                    // Payment already succeeded, so we continue
                                }
                            }

                            // Update audit log with validation and processing results
                            if (auditLogId) {
                                await paymentService.updatePaymentLog(auditLogId, {
                                    processing_status: 'SUCCESS',
                                    processing_result: {
                                        validation: validationResult,
                                        purchase: purchaseResult,
                                        risk_level: validationResult?.risk_level || null,
                                        risk_title: validationResult?.risk_title || null
                                    }
                                });
                            }

                            return res.status(200).json({ 
                                success: true, 
                                message: 'Bundle purchase processed successfully',
                                risk_level: validationResult?.risk_level || 0
                            });
                        } else {
                            // Bundle purchase failed
                            const errorMsg = purchaseResult.error || 'Bundle purchase failed';
                            console.error('Bundle purchase failed:', errorMsg);
                            
                            if (auditLogId) {
                                await paymentService.updatePaymentLog(auditLogId, {
                                    processing_status: 'FAILED',
                                    error_message: errorMsg,
                                    processing_result: purchaseResult
                                });
                            }
                            
                            return res.status(200).json({ success: false, error: errorMsg });
                        }
                    } else {
                        // Handle individual course purchase (COURSE type or legacy)
                        console.log(`Processing course purchase: Course ${itemId} for User ${userId}`);
                        
                        const takesResult = await courseService.takes(userId, itemId, amount, transactionId, couponId);
                        
                        // CRITICAL FIX: Update coupon usage status from 'pending' to 'completed'
                        // Always attempt update using transactionId (doesn't require couponId)
                        // This ensures status is updated even if tracking data lookup failed
                        try {
                            const CouponService = require('../../service/managerial/coupon');
                            const couponService = new CouponService();
                            
                            const updateResult = await couponService.updateCouponUsageStatus(transactionId, 'completed');
                            if (updateResult.success) {
                                if (updateResult.data && updateResult.data.length > 0) {
                                    console.log('IPN: ✅ Course coupon usage status updated to completed', {
                                        transactionId,
                                        couponId: couponId || 'unknown',
                                        updatedCount: updateResult.data.length
                                    });
                                } else {
                                    // EDGE CASE: No record found or already updated
                                    // This is OK - might not have coupon or already updated
                                    console.log('IPN: Course coupon usage record not found or already updated (non-critical):', {
                                        transactionId,
                                        couponId: couponId || 'unknown',
                                        message: updateResult.message
                                    });
                                }
                            } else {
                                console.warn('IPN: ⚠️ Failed to update course coupon usage status (non-critical):', {
                                    transactionId,
                                    couponId: couponId || 'unknown',
                                    error: updateResult.error
                                });
                            }
                        } catch (couponError) {
                            console.error('IPN: Error updating course coupon usage status (non-critical):', {
                                transactionId,
                                couponId: couponId || 'unknown',
                                error: couponError.message,
                                stack: couponError.stack
                            });
                            // Don't fail payment if coupon update fails
                        }
                        
                        if (takesResult.success) {
                            // Fulfil any optional physical books included with this course
                            try {
                                const bookFulfil = await paymentService.fulfilBookSelection(transactionId);
                                if (bookFulfil.fulfilled > 0) {
                                    console.log('IPN: ✅ Course book purchase(s) recorded', {
                                        transactionId,
                                        fulfilled: bookFulfil.fulfilled
                                    });
                                }
                            } catch (bookError) {
                                console.error('IPN: Error fulfilling course book selection (non-critical):', {
                                    transactionId,
                                    error: bookError.message
                                });
                                // Don't fail the payment if book fulfilment fails; admin can reconcile
                            }

                            const dbResults = await Promise.all([
                                paymentService.query(
                                    `select * from managerial_auth where id = $1`,
                                    [userId]
                                ),
                                paymentService.query(
                                    `select * from course where id = $1`,
                                    [itemId]
                                )
                            ]);
                            
                            // Send notifications if we have the required data
                            // CRITICAL: Payment already succeeded, so notifications are non-blocking
                            // If database queries fail, we skip notifications but payment still succeeds
                            if (dbResults[0].success && dbResults[0].data && dbResults[0].data.length > 0 &&
                                dbResults[1].success && dbResults[1].data && dbResults[1].data.length > 0) {
                                
                                try {
                                    // Get courseId from database result (same as email uses - this is the working standard)
                                    let courseId = dbResults[1].data[0].id;
                                    
                                    // CRITICAL: Ensure courseId is a valid number (not null/undefined)
                                    if (!courseId || isNaN(courseId)) {
                                        // Fallback to itemId as last resort
                                        courseId = itemId;
                                    }
                                    
                                    // Get course title
                                    const courseTitle = dbResults[1].data[0].title;
                                    
                                    const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
                                    
                                    const successUrl = `${frontendUrl}/billing/invoice/${encodeURIComponent(transactionId)}`;
                                    
                                    // SMS: Use dashboard link for course (courseId-specific dashboard)
                                    const courseIdStr = String(courseId);
                                    const dashboardUrl = `${frontendUrl}/dashboard/${courseIdStr}`;
                                    
                                    const text = `Dear ${dbResults[0].data[0].name}, you have successfully purchased "${courseTitle}" course from Math Pro. Your access code is: ${transactionId}. Start learning: ${dashboardUrl}`;
                                
                                const emailText = `<!DOCTYPE html>
                                <html lang="en">
                                
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Course Purchase Success</title>
                                  <style>
                                    body {
                                      font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                      margin: 0;
                                      padding: 0;
                                      background-color: #f4f4f4;
                                      color: #333;
                                    }
                                
                                    .container {
                                      background-color: #ffffff;
                                      width: 100%;
                                      max-width: 620px;
                                      margin: 40px auto;
                                      padding: 20px;
                                      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                                      border-radius: 8px;
                                      border-top: 3px solid #007bff;
                                    }
                                
                                    .header {
                                      background: linear-gradient(to right, #0062E6, #33AEFF);
                                      color: #ffffff;
                                      padding: 20px;
                                      border-radius: 5px 5px 0 0;
                                      text-align: center;
                                    }
                                
                                    .content {
                                      padding: 20px;
                                      line-height: 1.6;
                                    }
                                
                                    .content h3 {
                                      color: #0062E6;
                                    }
                                
                                    .content p,
                                    .content ul {
                                      margin: 10px 0;
                                    }
                                    
                                    .center { text-align: center; }
                                
                                    .content ul {
                                      list-style: inside square;
                                    }
                                
                                    .button,
                                    .fb-group-button {
                                      display: inline-block;
                                      padding: 12px 25px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      border-radius: 5px;
                                      font-weight: bold;
                                      transition: background-color 0.3s ease;
                                      margin-top: 10px;
                                    }
                                
                                    .button {
                                      background-color: #28a745;
                                    }
                                
                                    .button:hover {
                                      background-color: #218838;
                                    }
                                
                                    .fb-group-button {
                                      background-color: #3b5998;
                                    }
                                
                                    .fb-group-button:hover {
                                      background-color: #333c8c;
                                    }
                                
                                    .info-button {
                                      background-color: #007bff;
                                      display: inline-block;
                                      padding: 12px 25px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      border-radius: 5px;
                                      font-weight: bold;
                                      transition: background-color 0.3s ease;
                                      margin: 10px 5px;
                                    }
                                
                                    .info-button:hover {
                                      background-color: #0056b3;
                                    }
                                
                                    .button-group {
                                      text-align: center;
                                      margin: 25px 0;
                                    }
                                
                                    .footer {
                                      margin-top: 20px;
                                      text-align: center;
                                      font-size: 14px;
                                      color: #666;
                                    }
                                  </style>
                                </head>
                                
                                <body>
                                  <div class="container">
                                    <div class="header">
                                      <h2>অভিনন্দন! Course Purchase Successful!</h2>
                                    </div>
                                    <div class="content">
                                      <p class="center">Dear <strong>${dbResults[0].data[0].name}</strong>, you have successfully purchased <strong>${courseTitle}</strong> course from Math Pro!</p>

                                      <p class="center">Your access code is: <strong>${transactionId}</strong></p>
                                      <p class="center">আর তোমাকে সর্বাত্নক হেল্প করতে পাশে আছি <strong>আমরা কোডার ভাই পরিবার!</strong></p>
                                
                                      <div class="button-group">
                                        <a href="${successUrl}" class="info-button">📋 View Important Info & Next Steps</a>
                                      </div>
                                      
                                      <div class="button-group">
                                        <a href="${frontendUrl}/course/${courseId}" class="button">🎓 Start Learning Now</a>
                                      </div>
                                    </div>
                                    <div class="footer">
                                      <p>This is an automated message. Please do not reply directly to this email.</p>
                                      <p style="margin-top: 10px;">
                                        <a href="${successUrl}" style="color: #007bff; text-decoration: underline;">Click here to see important information about your purchase</a>
                                      </p>
                                    </div>
                                  </div>
                                </body>
                                
                                </html>`;
                                
                                    // CRITICAL FIX: Send notifications with proper error handling and logging
                                    // Check if user has valid contact info before sending
                                    const userPhone = dbResults[0].data[0].login || dbResults[0].data[0].phone;
                                    const userEmail = dbResults[0].data[0].profile?.email || dbResults[0].data[0].email;
                                    
                                    if (!userPhone && !userEmail) {
                                        console.warn('IPN: Cannot send notifications - user has no phone or email:', {
                                            userId,
                                            transactionId,
                                            courseId
                                        });
                                    } else {
                                        // Send notifications (don't await - let them run in background)
                                        // CRITICAL: Wrapped in try-catch to ensure payment never fails due to notification errors
                                        Promise.all([
                                            userPhone ? messagingService.sendMessage(userPhone, text).catch(err => {
                                                console.error('IPN: Course SMS send error:', {
                                                    userId,
                                                    transactionId,
                                                    phone: userPhone,
                                                    error: err.message
                                                });
                                                return { success: false, error: err.message };
                                            }) : Promise.resolve({ success: false, error: 'No phone number' }),
                                            userEmail ? messagingService.sendMail(userEmail, 'Course Purchased Confirmation | Math Pro', emailText).catch(err => {
                                                console.error('IPN: Course Email send error:', {
                                                    userId,
                                                    transactionId,
                                                    email: userEmail,
                                                    error: err.message
                                                });
                                                return { success: false, error: err.message };
                                            }) : Promise.resolve({ success: false, error: 'No email address' }),
                                            courseService.createLog(logNames.coursePurchase, {
                                                user_id: userId,
                                                course_id: courseId || itemId,
                                                amount: req.body.amount || amount
                                            }).catch(err => console.error('IPN: Log creation error:', err))
                                        ]).then(results => {
                                            console.log('IPN: Course notifications sent:', {
                                                userId,
                                                transactionId,
                                                courseId,
                                                sms: results[0]?.success ? 'sent' : 'failed',
                                                email: results[1]?.success ? 'sent' : 'failed'
                                            });
                                        }).catch(err => {
                                            console.error('IPN: Course notification error:', {
                                                userId,
                                                transactionId,
                                                courseId,
                                                error: err.message,
                                                stack: err.stack
                                            });
                                        });
                                    }
                                } catch (notificationError) {
                                    // CRITICAL: Never let notification errors break payment processing
                                    // Payment already succeeded, so we continue
                                }
                            }

                            // Update audit log with validation and processing results
                            if (auditLogId) {
                                await paymentService.updatePaymentLog(auditLogId, {
                                    processing_status: 'SUCCESS',
                                    processing_result: {
                                        validation: validationResult,
                                        enrollment: takesResult,
                                        risk_level: validationResult?.risk_level || null,
                                        risk_title: validationResult?.risk_title || null
                                    }
                                });
                            }

                            return res.status(200).json({ 
                                success: true, 
                                message: 'Course purchase processed successfully',
                                risk_level: validationResult?.risk_level || 0
                            });
                        } else {
                            // Course enrollment failed
                            const errorMsg = takesResult.error?.message || 'Course enrollment failed';
                            console.error('Course enrollment failed:', errorMsg);
                            
                            if (auditLogId) {
                                await paymentService.updatePaymentLog(auditLogId, {
                                    processing_status: 'FAILED',
                                    error_message: errorMsg,
                                    processing_result: takesResult
                                });
                            }
                            
                            return res.status(200).json({ success: false, error: errorMsg });
                        }
                    }
                } catch (processingError) {
                    // Error during processing
                    const errorMsg = processingError.message || 'Payment processing error';
                    console.error('IPN Processing Error:', processingError);
                    
                    if (auditLogId) {
                        await paymentService.updatePaymentLog(auditLogId, {
                            processing_status: 'ERROR',
                            error_message: errorMsg,
                            processing_result: { error: errorMsg, stack: processingError.stack }
                        });
                    }
                    
                    return res.status(200).json({ success: false, error: errorMsg });
                }
            } else {
                // Status is not VALID (FAILED, CANCELLED, etc.)
                console.log('IPN: Payment status is not VALID:', status);
                
                if (auditLogId) {
                    await paymentService.updatePaymentLog(auditLogId, {
                        processing_status: 'FAILED',
                        error_message: `Payment status: ${status}`
                    });
                }
                
                return res.status(200).json({ success: false, message: `Payment status: ${status}` });
            }
        } catch (error) {
            // Top-level error handler
            console.error('IPN Endpoint Error:', error);
            
            if (auditLogId) {
                await paymentService.updatePaymentLog(auditLogId, {
                    processing_status: 'ERROR',
                    error_message: error.message || 'Unknown error',
                    processing_result: { error: error.message, stack: error.stack }
                }).catch(err => console.error('Failed to update audit log:', err));
            }
            
            // Always return 200 to SSLCommerz (they expect 200 even on errors)
            return res.status(200).json({ success: false, error: 'Internal server error' });
        }
    }

    getPaymentHistory = async (req, res) => {
        try {
            const userId = req.user?.id || req.body.user_id;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
            }

            const result = await paymentService.getPaymentHistoryAndEnrollments(userId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getPaymentHistory controller:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    // Get payment audit logs (new API - doesn't break existing functionality)
    // Supports both user and admin authentication
    getPaymentAuditLogs = async (req, res) => {
        try {
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
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getPaymentAuditLogs controller:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    // Export payment audit logs (returns all matching records without pagination)
    // Admin only - for CSV export functionality
    exportPaymentAuditLogs = async (req, res) => {
        try {
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
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in exportPaymentAuditLogs controller:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    // Manual reconciliation endpoint (new API - doesn't break existing functionality)
    // Supports both user and admin authentication
    reconcilePayment = async (req, res) => {
        try {
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
                            const frontendUrl = process.env.FRONTEND_URL || 'https://courses.mathpro.com';
                            
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
                                            console.error('Reconciliation: Bundle SMS send error:', err);
                                            return { success: false };
                                        }) : Promise.resolve({ success: false, error: 'No phone' }),
                                        userEmail ? messagingService.sendMail(userEmail, 'Bundle Purchase Confirmation | Math Pro', emailText).catch(err => {
                                            console.error('Reconciliation: Bundle Email send error:', err);
                                            return { success: false };
                                        }) : Promise.resolve({ success: false, error: 'No email' })
                                    ]).then(() => {
                                        console.log('Reconciliation: Notifications sent for bundle purchase');
                                    }).catch(err => {
                                        console.error('Reconciliation: Notification error:', err);
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
                                            console.error('Reconciliation: Course SMS send error:', err);
                                            return { success: false };
                                        }) : Promise.resolve({ success: false, error: 'No phone' }),
                                        userEmail ? messagingService.sendMail(userEmail, 'Course Purchased Confirmation | Math Pro', emailText).catch(err => {
                                            console.error('Reconciliation: Course Email send error:', err);
                                            return { success: false };
                                        }) : Promise.resolve({ success: false, error: 'No email' })
                                    ]).then(() => {
                                        console.log('Reconciliation: Notifications sent for course purchase');
                                    }).catch(err => {
                                        console.error('Reconciliation: Notification error:', err);
                                    });
                                }
                            }
                        }
                    }
                } catch (notificationError) {
                    // CRITICAL: Never fail reconciliation due to notification errors
                    console.error('Reconciliation: Error sending notifications (non-critical):', notificationError);
                }
            }
            
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in reconcilePayment controller:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
}

module.exports={PaymentController}
