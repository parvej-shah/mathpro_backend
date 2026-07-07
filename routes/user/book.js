const router = require("express-promise-router")();
const BookController = require('../../controllers/user/book').BookController
const { ipLimiter } = require("../../util/rateLimitPolicies");

const bookController = new BookController()

const publicBookReadLimit = ipLimiter(
  "book:public-read",
  60,
  15 * 60 * 1000,
  { message: "Too many book requests. Please try again later." }
);

router.route("/").get(publicBookReadLimit, bookController.list);
router.route("/:id").get(publicBookReadLimit, bookController.getEntry);

module.exports = router
