const Controller = require("../base").Controller;
const { handle } = require('../base');
const FAQService = require("../../service/managerial/faq").FAQService;

const faqService = new FAQService();
const idOf = (req) => parseInt(req.params.id, 10);

class FAQController extends Controller {
  list = handle(() => faqService.listAdmin());

  getEntry = handle((req) => faqService.getById(idOf(req)));

  create = handle((req) => faqService.create(req.body));

  update = handle((req) => faqService.update(idOf(req), req.body));

  deleteEntry = handle((req) => faqService.deleteEntry(idOf(req)));
}

module.exports = { FAQController };
