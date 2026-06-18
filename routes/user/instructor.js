/**
 * User Instructor Routes
 * Public endpoints for instructor information
 */

const router = require("express-promise-router")();
const InstructorController = require("../../controllers/user/instructor").InstructorController;
const { ipLimiter } = require("../../util/rateLimitPolicies");

const instructorController = new InstructorController();

const instructorListLimit = ipLimiter(
  "instructor:list",
  30,
  15 * 60 * 1000,
  { message: "Too many instructor requests. Please try again later." }
);

// Public endpoint - no authentication required
router.route("/list").get(instructorListLimit, instructorController.list);

module.exports = router;
