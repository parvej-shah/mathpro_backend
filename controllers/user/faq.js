const Controller = require("../base").Controller;
const FAQService = require("../../service/managerial/faq").FAQService;

const faqService = new FAQService();

class FAQController extends Controller {
  list = async (req, res) => {
    const result = await faqService.listPublic();
    return res.status(result.success ? 200 : 400).json(result);
  };
}

module.exports = { FAQController };
