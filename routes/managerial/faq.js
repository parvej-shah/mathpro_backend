const router = require("express-promise-router")();
const FAQController = require("../../controllers/managerial/faq").FAQController;
const { requirePermission } = require("../../service/authMiddleWares");
const { PERMISSIONS } = require("../../util/permissions");

const faqController = new FAQController();
const requireFaqManage = requirePermission(PERMISSIONS.COURSE.MANAGE.ALL);

router.route("/list").get(requireFaqManage, faqController.list);
router.route("/get/:id").get(requireFaqManage, faqController.getEntry);
router.route("/create").post(requireFaqManage, faqController.create);
router.route("/update/:id").put(requireFaqManage, faqController.update);
router.route("/delete/:id").delete(requireFaqManage, faqController.deleteEntry);

module.exports = router;
