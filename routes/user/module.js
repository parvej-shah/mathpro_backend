const router = require("express-promise-router")();
const ModuleController=require('../../controllers/managerial/module').ModuleController
const { ModuleViewsController } = require('../../controllers/user/moduleViews')
const { QuizAttemptController } = require('../../controllers/user/quizAttempt')
const userAuthMiddleWare=require('../../service/authMiddleWares').authenticateUser
const { actorLimiter } = require('../../util/rateLimitPolicies')

const moduleController=new ModuleController()
const moduleViewsController = new ModuleViewsController()
const quizAttemptController = new QuizAttemptController()

const moduleWriteLimit = actorLimiter(
  'module:write',
  10,
  15 * 60 * 1000,
  { message: 'Too many module actions. Please try again later.' }
);

const moduleReadLimit = actorLimiter(
  'module:read',
  30,
  15 * 60 * 1000,
  { message: 'Too many module requests. Please try again later.' }
);

router.route("/addProgress/:id").post(userAuthMiddleWare, moduleWriteLimit, moduleController.addProgress);

// Quiz attempt (backend-graded, one attempt per student per quiz module)
router.route("/quiz/:id/attempt").get(userAuthMiddleWare, moduleReadLimit, quizAttemptController.getAttempt);
router.route("/quiz/:id/submit").post(userAuthMiddleWare, moduleWriteLimit, quizAttemptController.submit);
router.route("/get/:id").get(userAuthMiddleWare, moduleReadLimit, moduleController.getEntryUser);
router.route("/live").get(userAuthMiddleWare, moduleReadLimit, moduleController.getLiveModules);
router.route("/live/:courseId").get(userAuthMiddleWare, moduleReadLimit, moduleController.getLiveModulesForCourse);

// Module views routes
router.route("/recordView").post(userAuthMiddleWare, moduleWriteLimit, moduleViewsController.recordView);
router.route("/recentViews/:courseId").get(userAuthMiddleWare, moduleReadLimit, moduleViewsController.getRecentViews);
router.route("/mostRecent/:courseId").get(userAuthMiddleWare, moduleReadLimit, moduleViewsController.getMostRecent);
router.route("/recentViews/:courseId").delete(userAuthMiddleWare, moduleWriteLimit, moduleViewsController.clearRecentViews);

module.exports=router
