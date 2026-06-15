const router = require("express-promise-router")();
const ActivityController=require('../../controllers/user/activity').ActivityController
const authenticateInv=require('../../service/authMiddleWares').authenticateInv

const activityController=new ActivityController()

router.route('/').post(authenticateInv,activityController.store)
router.route('/').get(authenticateInv,activityController.get)
module.exports=router