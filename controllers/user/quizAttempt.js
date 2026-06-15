const Controller = require("../base").Controller;
const { QuizAttemptService } = require("../../service/managerial/quizAttempt.js");

const quizAttemptService = new QuizAttemptService();

class QuizAttemptController extends Controller {
    constructor() {
        super();
    }

    // GET /user/module/quiz/:id/attempt
    getAttempt = async (req, res) => {
        const result = await quizAttemptService.getAttempt(req.user.id, parseInt(req.params.id));
        return res.status(result.success ? 200 : 400).json(result);
    }

    // POST /user/module/quiz/:id/submit  { answers: { "0": "...", ... } }
    submit = async (req, res) => {
        const answers = req.body.answers || {};
        const result = await quizAttemptService.submitAttempt(
            req.user.id,
            parseInt(req.params.id),
            answers,
        );
        return res.status(result.success ? 200 : 400).json(result);
    }
}

module.exports = { QuizAttemptController };
