const router = require("express-promise-router")();
const PaymentController = require("../../controllers/user/payment").PaymentController;
const { requireScopeAccess } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");
const { actorLimiter } = require("../../util/rateLimitPolicies");

const paymentController = new PaymentController();

const requirePaymentManage = requireScopeAccess("payment", "manage");

const paymentReadLimit = actorLimiter(
  "admin-payment:read",
  20,
  15 * 60 * 1000,
  { message: "Too many payment admin requests. Please try again later." }
);

const paymentWriteLimit = actorLimiter(
  "admin-payment:write",
  5,
  60 * 60 * 1000,
  { message: "Too many payment reconciliation requests. Please try again later." }
);

router.route("/audit-logs").get(requirePaymentManage, paymentReadLimit, paymentController.getPaymentAuditLogs);
router.route("/audit-logs").post(requirePaymentManage, paymentReadLimit, paymentController.getPaymentAuditLogs);
router.route("/audit-logs/export").get(requirePaymentManage, paymentWriteLimit, paymentController.exportPaymentAuditLogs);
router.route("/reconcile").post(requirePaymentManage, paymentWriteLimit, paymentController.reconcilePayment);
router.route("/reconcile/:sslcommerz_tran_id").post(requirePaymentManage, paymentWriteLimit, paymentController.reconcilePayment);

module.exports = router;
