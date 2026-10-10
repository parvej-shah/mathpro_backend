const Controller = require("../base.js").Controller;
const { respond } = require('../base');
const BookService = require("../../service/managerial/book.js").BookService;

const bookService = new BookService();

const VALID_FULFILLMENT_STATUSES = ['pending', 'shipped', 'delivered', 'cancelled'];

class BookController extends Controller {
    constructor() {
        super();
    }

    // ---- catalogue CRUD ------------------------------------------------------

    list = async (req, res) => {
        var result = await bookService.list();
        return respond(res, result);
    };

    getEntry = async (req, res) => {
        var result = await bookService.get(parseInt(req.params.id));
        return respond(res, result);
    };

    create = async (req, res) => {
        var result = await bookService.create(req.body, req.user && req.user.id);
        return respond(res, result);
    };

    update = async (req, res) => {
        var result = await bookService.update(parseInt(req.params.id), req.body);
        return respond(res, result);
    };

    deleteEntry = async (req, res) => {
        var result = await bookService.deleteEntry(parseInt(req.params.id));
        return respond(res, result);
    };

    // ---- course_book link ----------------------------------------------------

    listForCourse = async (req, res) => {
        var result = await bookService.listForCourse(parseInt(req.params.courseId));
        return respond(res, result);
    };

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

    listOrders = async (req, res) => {
        var result = await bookService.listOrders(req.query.status || null);
        return respond(res, result);
    };

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
