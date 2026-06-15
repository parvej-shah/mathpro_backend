const Controller = require("../base").Controller;
const FAQService = require("../../service/managerial/faq").FAQService;

const faqService = new FAQService();

class FAQController extends Controller {
  list = async (req, res) => {
    const result = await faqService.listAdmin();
    return res.status(result.success ? 200 : 400).json(result);
  };

  getEntry = async (req, res) => {
    const result = await faqService.getById(parseInt(req.params.id, 10));
    return res.status(result.success ? 200 : 400).json(result);
  };

  create = async (req, res) => {
    const result = await faqService.create(req.body);
    return res.status(result.success ? 200 : 400).json(result);
  };

  update = async (req, res) => {
    const result = await faqService.update(parseInt(req.params.id, 10), req.body);
    return res.status(result.success ? 200 : 400).json(result);
  };

  deleteEntry = async (req, res) => {
    const result = await faqService.deleteEntry(parseInt(req.params.id, 10));
    return res.status(result.success ? 200 : 400).json(result);
  };
}

module.exports = { FAQController };
