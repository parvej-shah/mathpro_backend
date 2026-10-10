const Controller = require("../base").Controller;
const { respond } = require('../base');
const FAQService = require("../../service/managerial/faq").FAQService;

const faqService = new FAQService();

class FAQController extends Controller {
  list = async (req, res) => {
    const result = await faqService.listAdmin();
    return respond(res, result);
  };

  getEntry = async (req, res) => {
    const result = await faqService.getById(parseInt(req.params.id, 10));
    return respond(res, result);
  };

  create = async (req, res) => {
    const result = await faqService.create(req.body);
    return respond(res, result);
  };

  update = async (req, res) => {
    const result = await faqService.update(parseInt(req.params.id, 10), req.body);
    return respond(res, result);
  };

  deleteEntry = async (req, res) => {
    const result = await faqService.deleteEntry(parseInt(req.params.id, 10));
    return respond(res, result);
  };
}

module.exports = { FAQController };
