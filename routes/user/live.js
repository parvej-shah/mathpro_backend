const { authenticateInv } = require("../../service/authMiddleWares");
const router = require("express-promise-router")();
const LiveController=require('../../controllers/managerial/live').LiveController
const userAuthMiddleWare=require('../../service/authMiddleWares').authenticateUser

const liveController=new LiveController()

router.route("/list/:id").get(userAuthMiddleWare,liveController.listForUser);
router.route("/get/:id").get(userAuthMiddleWare,liveController.getEntryForUser);
router.route("/interest/:id").post(userAuthMiddleWare,liveController.interest);
router.route("/addFeed/:id").post(authenticateInv,liveController.addFeed);
router.route("/getAllFeeds/:id").get(authenticateInv,liveController.getAllFeeds);

module.exports=router