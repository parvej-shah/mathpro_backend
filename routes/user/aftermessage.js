const { authenticateUser } = require("../../service/authMiddleWares");
const router = require("express-promise-router")();
const {
  AfterMessageController,
} = require("../../controllers/user/aftermessage");

const afterMessageController = new AfterMessageController();

// Get messages for a specific course or bundle
router
  .route("/:itemType/:itemId")
  .get(authenticateUser, afterMessageController.getMessagesByItem);

module.exports = router;
