const router = require('express-promise-router')();
const ContactController = require('../controllers/contactController').ContactController;
const { authenticateAdmin } = require('../service/authMiddleWares');

const contactController = new ContactController();

// Public endpoint: Submit contact form (with rate limiting)
router.route('/')
    .post(contactController.rateLimitMiddleware, contactController.submitContact)
    .get(authenticateAdmin, contactController.getAllSubmissions); // Admin only

// Admin endpoints: Get single submission and update status
router.route('/:id')
    .get(authenticateAdmin, contactController.getSubmissionById);

router.route('/:id/status')
    .put(authenticateAdmin, contactController.updateSubmissionStatus);

module.exports = router;

