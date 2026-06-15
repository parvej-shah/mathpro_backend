const router = require("express-promise-router")();
const FAQController = require("../../controllers/user/faq").FAQController;

const faqController = new FAQController();

router.route("/list").get(faqController.list);

module.exports = router;
