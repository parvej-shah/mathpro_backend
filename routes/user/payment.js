const { authenticateUser } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const PaymentController=require('../../controllers/user/payment').PaymentController
const { actorLimiter, ipLimiter } = require('../../util/rateLimitPolicies');

const paymentController=new PaymentController()

const paymentInitiateLimit = actorLimiter(
  "payment:initiate",
  5,
  15 * 60 * 1000,
  { message: "Too many payment attempts. Please try again later." }
);

const paymentCallbackLimit = ipLimiter(
  "payment:callback",
  30,
  15 * 60 * 1000,
  { message: "Too many payment callback requests. Please try again later." }
);

const paymentIpnLimit = ipLimiter(
  "payment:ipn",
  120,
  15 * 60 * 1000,
  { message: "Too many payment notifications. Please try again later." }
);

const paymentReadLimit = actorLimiter(
  "payment:read",
  20,
  15 * 60 * 1000,
  { message: "Too many payment requests. Please try again later." }
);

const paymentAuditLimit = actorLimiter(
  "payment:audit",
  10,
  15 * 60 * 1000,
  { message: "Too many payment audit requests. Please try again later." }
);

router.route("/initiate/:id").post(authenticateUser, paymentInitiateLimit, paymentController.initiatePayment);
router.route("/initiate-for-bundle/:id").post(authenticateUser, paymentInitiateLimit, paymentController.initiatePaymentForBundle);
router.route("/redirect/:status").post(paymentCallbackLimit, paymentController.redirect);
router.route("/redirectNew/").post(paymentCallbackLimit, paymentController.redirectNew);
// SSLCommerz payment callback handlers (POST -> GET redirect to frontend)
router.route("/success").post(paymentCallbackLimit, paymentController.handlePaymentSuccess);
router.route("/failure").post(paymentCallbackLimit, paymentController.handlePaymentFailure);
router.route("/cancel").post(paymentCallbackLimit, paymentController.handlePaymentCancel);
router.route("/ipn").post(paymentIpnLimit, paymentController.ipn);
router.route("/history").get(authenticateUser, paymentReadLimit, paymentController.getPaymentHistory);
// New endpoints for payment audit logs (users can view their own logs)
// NOTE: Reconciliation is ADMIN-ONLY and should use /admin/payment/reconcile
router.route("/audit-logs").get(authenticateUser, paymentAuditLimit, paymentController.getPaymentAuditLogs);
router.route("/audit-logs").post(authenticateUser, paymentAuditLimit, paymentController.getPaymentAuditLogs);
// Reconciliation removed from user routes - SECURITY: Only admins should reconcile payments

module.exports=router
