const { authenticateUser } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const ProfileController = require('../../controllers/user/profile').ProfileController;

const profileController = new ProfileController();

// GET /user/profile - Get current user's profile for checkout modal
router.route("/").get(authenticateUser, profileController.getProfile);

// PUT /user/profile - Update current user's profile for checkout modal
router.route("/").put(authenticateUser, profileController.updateProfile);

// PUT /user/profile/password - Set or change current user's password
router.route("/password").put(authenticateUser, profileController.changePassword);

module.exports = router;
