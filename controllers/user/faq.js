const Controller = require("../base").Controller;
const { handle } = require('../base');
const FAQService = require("../../service/managerial/faq").FAQService;

const faqService = new FAQService();

class FAQController extends Controller {
  list = handle(() => faqService.listPublic());
}

module.exports = { FAQController };
