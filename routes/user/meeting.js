const router = require("express-promise-router")();
const MeetingController=require('../../controllers/user/meeting').MeetingController
const userAuthMiddleWare=require('../../service/authMiddleWares').authenticateUser

const meetingController=new MeetingController()

router.route("/getMeetingProps/:id").get(userAuthMiddleWare,meetingController.getMeetingProps);

module.exports=router