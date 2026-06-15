/**
 * User Instructor Routes
 * Public endpoints for instructor information
 */

const router = require("express-promise-router")();
const InstructorController = require("../../controllers/user/instructor").InstructorController;

const instructorController = new InstructorController();

// Public endpoint - no authentication required
router.route("/list").get(instructorController.list);

module.exports = router;

