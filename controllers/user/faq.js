const Controller = require("../base").Controller;
const { respond } = require('../base');
const FAQService = require("../../service/managerial/faq").FAQService;

const faqService = new FAQService();

class FAQController extends Controller {
  list = async (req, res) => {
    const result = await faqService.listPublic();
    return respond(res, result);
  };
}

module.exports = { FAQController };
