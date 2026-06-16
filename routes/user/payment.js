const { authenticateUser } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const PaymentController=require('../../controllers/user/payment').PaymentController

const paymentController=new PaymentController()

router.route("/initiate/:id").post(authenticateUser,paymentController.initiatePayment);
router.route("/initiate-for-bundle/:id").post(authenticateUser,paymentController.initiatePaymentForBundle);
router.route("/redirect/:status").post(paymentController.redirect);
router.route("/redirectNew/").post(paymentController.redirectNew);
// SSLCommerz payment callback handlers (POST -> GET redirect to frontend)
router.route("/success").post(paymentController.handlePaymentSuccess);
router.route("/failure").post(paymentController.handlePaymentFailure);
router.route("/cancel").post(paymentController.handlePaymentCancel);
router.route("/ipn").post(paymentController.ipn);
router.route("/history").get(authenticateUser, paymentController.getPaymentHistory);
// New endpoints for payment audit logs (users can view their own logs)
// NOTE: Reconciliation is ADMIN-ONLY and should use /admin/payment/reconcile
router.route("/audit-logs").get(authenticateUser, paymentController.getPaymentAuditLogs);
router.route("/audit-logs").post(authenticateUser, paymentController.getPaymentAuditLogs);
// Reconciliation removed from user routes - SECURITY: Only admins should reconcile payments

module.exports=router