const router = require("express-promise-router")();
const FAQController = require("../../controllers/user/faq").FAQController;
const { ipLimiter } = require("../../util/rateLimitPolicies");

const faqController = new FAQController();

const faqListLimit = ipLimiter(
  "faq:list",
  30,
  15 * 60 * 1000,
  { message: "Too many FAQ requests. Please try again later." }
);

router.route("/list").get(faqListLimit, faqController.list);

module.exports = router;
