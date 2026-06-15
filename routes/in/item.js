const router = require("express-promise-router")();
const ItemController=require('../../controllers/in/item').ItemController
const authenticateInv=require('../../service/authMiddleWares').authenticateInv

const itemController=new ItemController()

router.route("/list/:platform/:level/:parentId").get(authenticateInv,itemController.list);
router.route("/create/:platform/:level/:parentId").post(authenticateInv,itemController.create);
router.route("/update/:id").put(authenticateInv,itemController.update);
router.route("/delete/:id").delete(authenticateInv,itemController.deleteEntry);
router.route("/qr").get(itemController.qrVisit);

module.exports=router