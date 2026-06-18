const router = require('express-promise-router')();
const adminAuthMiddleWare = require('../../service/authMiddleWares').authenticateAdmin;
const UploadControllerV2 = require('../../controllers/managerial/uploadV2').UploadControllerV2;
const { actorLimiter } = require('../../util/rateLimitPolicies');

const uploadControllerV2 = new UploadControllerV2();

const adminUploadReadLimit = actorLimiter(
  'upload:admin-presigned-url',
  20,
  60 * 60 * 1000,
  { message: 'Too many upload requests. Please try again later.' }
);

const adminUploadDeleteLimit = actorLimiter(
  'upload:admin-delete',
  10,
  60 * 60 * 1000,
  { message: 'Too many delete requests. Please try again later.' }
);

router.route('/presigned-url')
    .post(adminAuthMiddleWare, adminUploadReadLimit, uploadControllerV2.createPresignedUrl);

router.route('/delete')
    .post(adminAuthMiddleWare, adminUploadDeleteLimit, uploadControllerV2.deleteObject);

module.exports = router;
