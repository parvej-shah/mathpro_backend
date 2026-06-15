const { requirePermission } = require("../../service/authMiddleWares");
const router = require("express-promise-router")();
const BookController = require('../../controllers/managerial/book').BookController;
const { PERMISSIONS } = require('../../util/permissions');

const bookController = new BookController();

const requireBookManage = requirePermission(PERMISSIONS.BOOK.MANAGE.ALL);

// Admin fulfilment of physical book orders
router.route("/orders").get(requireBookManage, bookController.listOrders);
router.route("/orders/:id/status").put(requireBookManage, bookController.updateOrderStatus);

// Attach / detach books to a course (course_book)
router.route("/course/:courseId")
    .get(requireBookManage, bookController.listForCourse)
    .post(requireBookManage, bookController.attach);
router.route("/course/:courseId/:bookId").delete(requireBookManage, bookController.detach);

// Catalogue CRUD
router.route("/")
    .get(requireBookManage, bookController.list)
    .post(requireBookManage, bookController.create);
router.route("/:id")
    .get(requireBookManage, bookController.getEntry)
    .put(requireBookManage, bookController.update)
    .delete(requireBookManage, bookController.deleteEntry);

module.exports = router;
