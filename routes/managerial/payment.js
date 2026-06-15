const router = require("express-promise-router")();
const PaymentController = require("../../controllers/user/payment").PaymentController;
const { requireScopeAccess } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const paymentController = new PaymentController();

const requirePaymentManage = requireScopeAccess("payment", "manage");

router.route("/audit-logs").get(requirePaymentManage, paymentController.getPaymentAuditLogs);
router.route("/audit-logs").post(requirePaymentManage, paymentController.getPaymentAuditLogs);
router.route("/audit-logs/export").get(requirePaymentManage, paymentController.exportPaymentAuditLogs);
router.route("/reconcile").post(requirePaymentManage, paymentController.reconcilePayment);
router.route("/reconcile/:sslcommerz_tran_id").post(requirePaymentManage, paymentController.reconcilePayment);

module.exports = router;

