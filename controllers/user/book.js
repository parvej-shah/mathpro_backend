const Controller = require("../base").Controller;
const { respond } = require('../base');
const BookService = require("../../service/managerial/book").BookService;

const bookService = new BookService();

class BookController extends Controller {
    constructor() {
        super();
    }

    list = async (req, res) => {
        var result = await bookService.listActive();
        return respond(res, result);
    };

    getEntry = async (req, res) => {
        var result = await bookService.getActive(parseInt(req.params.id));
        return respond(res, result);
    };
}

module.exports = { BookController };
