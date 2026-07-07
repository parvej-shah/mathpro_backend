const Controller = require("../base").Controller;
const BookService = require("../../service/managerial/book").BookService;

const bookService = new BookService();

class BookController extends Controller {
    constructor() {
        super();
    }

    list = async (req, res) => {
        var result = await bookService.listActive();
        return res.status(result.success ? 200 : 400).json(result);
    };

    getEntry = async (req, res) => {
        var result = await bookService.getActive(parseInt(req.params.id));
        return res.status(result.success ? 200 : 400).json(result);
    };
}

module.exports = { BookController };
