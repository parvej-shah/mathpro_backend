const { authenticateInv, authenticateAdmin } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const SupportController=require('../../controllers/user/support').SupportController
const userAuthMiddleWare=require('../../service/authMiddleWares').authenticateUser

const supportController=new SupportController()

router.route("/issue/create").post(authenticateInv,supportController.createIssue);
router.route("/issue/reopen/:id").put(authenticateInv,supportController.reOpenIssue);
router.route("/issue/resolve/:id").put(authenticateInv,supportController.resolveIssue);
router.route("/response/create/:id").post(authenticateInv,supportController.createResponse);
router.route("/issue/getAllPendingIssues").get(authenticateAdmin,supportController.getAllPendingIssues);
router.route("/issue/getMyIssues").get(authenticateInv,supportController.getMyIssues);
router.route("/issue/getResponses/:id").get(authenticateInv,supportController.getResponses);
router.route("/issue/getResponsesLongPolling/:id").get(authenticateInv,supportController.getResponsesLongPolling);


module.exports=router