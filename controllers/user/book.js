const Controller = require("../base").Controller;
const { handle } = require('../base');
const BookService = require("../../service/managerial/book").BookService;

const bookService = new BookService();

class BookController extends Controller {
    constructor() {
        super();
    }

    list = handle(() => bookService.listActive());

    getEntry = handle((req) => bookService.getActive(parseInt(req.params.id)));
}

module.exports = { BookController };
