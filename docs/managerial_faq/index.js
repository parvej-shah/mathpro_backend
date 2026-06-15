const faqList = require("./faq_list");
const faqGet = require("./faq_get");
const faqCreate = require("./faq_create");
const faqUpdate = require("./faq_update");
const faqDelete = require("./faq_delete");

module.exports = {
  paths: {
    "/admin/faq/list": {
      ...faqList,
    },
    "/admin/faq/get/{id}": {
      ...faqGet,
    },
    "/admin/faq/create": {
      ...faqCreate,
    },
    "/admin/faq/update/{id}": {
      ...faqUpdate,
    },
    "/admin/faq/delete/{id}": {
      ...faqDelete,
    },
    "/user/faq/list": {
      get: {
        tags: ["FAQ Management"],
        description: "List active public FAQs used by the homepage, courses page, and course detail page",
        operationId: "userFaqList",
        responses: {
          200: { description: "Public FAQ list retrieved successfully" },
          400: { description: "Failed to fetch public FAQs" },
        },
      },
    },
  },
};
