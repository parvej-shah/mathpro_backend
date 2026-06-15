const router = require("express-promise-router")();
const ModuleController=require('../../controllers/managerial/module').ModuleController
const { ModuleViewsController } = require('../../controllers/user/moduleViews')
const { QuizAttemptController } = require('../../controllers/user/quizAttempt')
const userAuthMiddleWare=require('../../service/authMiddleWares').authenticateUser

const moduleController=new ModuleController()
const moduleViewsController = new ModuleViewsController()
const quizAttemptController = new QuizAttemptController()

router.route("/addProgress/:id").post(userAuthMiddleWare,moduleController.addProgress);

// Quiz attempt (backend-graded, one attempt per student per quiz module)
router.route("/quiz/:id/attempt").get(userAuthMiddleWare, quizAttemptController.getAttempt);
router.route("/quiz/:id/submit").post(userAuthMiddleWare, quizAttemptController.submit);
router.route("/get/:id").get(userAuthMiddleWare,moduleController.getEntryUser);
router.route("/live").get(userAuthMiddleWare,moduleController.getLiveModules);
router.route("/live/:courseId").get(userAuthMiddleWare,moduleController.getLiveModulesForCourse);

// Module views routes
router.route("/recordView").post(userAuthMiddleWare, moduleViewsController.recordView);
router.route("/recentViews/:courseId").get(userAuthMiddleWare, moduleViewsController.getRecentViews);
router.route("/mostRecent/:courseId").get(userAuthMiddleWare, moduleViewsController.getMostRecent);
router.route("/recentViews/:courseId").delete(userAuthMiddleWare, moduleViewsController.clearRecentViews);

module.exports=router
