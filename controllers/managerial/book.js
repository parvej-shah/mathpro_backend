const Controller = require("../base.js").Controller;
const { respond, handle } = require('../base');
const BookService = require("../../service/managerial/book.js").BookService;

const bookService = new BookService();

const VALID_FULFILLMENT_STATUSES = ['pending', 'shipped', 'delivered', 'cancelled'];

class BookController extends Controller {
    constructor() {
        super();
    }

    // ---- catalogue CRUD ------------------------------------------------------

    list = handle(() => bookService.list());

    getEntry = handle((req) => bookService.get(parseInt(req.params.id)));

    create = handle((req) => bookService.create(req.body, req.user && req.user.id));

    update = handle((req) => bookService.update(parseInt(req.params.id), req.body));

    deleteEntry = handle((req) => bookService.deleteEntry(parseInt(req.params.id)));

    // ---- course_book link ----------------------------------------------------

    listForCourse = handle((req) => bookService.listForCourse(parseInt(req.params.courseId)));

    attach = async (req, res) => {
        const bookId = parseInt(req.body.book_id);
        if (!bookId) {
            return res.status(400).json({ success: false, error: 'book_id is required' });
        }
        var result = await bookService.attach(parseInt(req.params.courseId), bookId);
        return respond(res, result);
    };

    detach = async (req, res) => {
        var result = await bookService.detach(
            parseInt(req.params.courseId),
            parseInt(req.params.bookId)
        );
        return respond(res, result);
    };

    // ---- admin fulfilment ----------------------------------------------------

    listOrders = handle((req) => bookService.listOrders(req.query.status || null));

    updateOrderStatus = async (req, res) => {
        const status = req.body.fulfillment_status;
        if (!VALID_FULFILLMENT_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `fulfillment_status must be one of: ${VALID_FULFILLMENT_STATUSES.join(', ')}`
            });
        }
        var result = await bookService.updateOrderStatus(parseInt(req.params.id), status);
        return respond(res, result);
    };
}

module.exports = { BookController };
