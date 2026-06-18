const { authenticateUser } = require("../../service/authMiddleWares");

const router = require("express-promise-router")();
const ProfileController = require('../../controllers/user/profile').ProfileController;
const { actorLimiter } = require("../../util/rateLimitPolicies");

const profileController = new ProfileController();

const profileWriteLimit = actorLimiter(
  "profile:write",
  10,
  15 * 60 * 1000,
  { message: "Too many profile updates. Please try again later." }
);

// GET /user/profile - Get current user's profile for checkout modal
router.route("/").get(authenticateUser, profileController.getProfile);

// PUT /user/profile - Update current user's profile for checkout modal
router.route("/").put(authenticateUser, profileWriteLimit, profileController.updateProfile);

// PUT /user/profile/password - Set or change current user's password
router.route("/password").put(authenticateUser, profileWriteLimit, profileController.changePassword);

module.exports = router;
