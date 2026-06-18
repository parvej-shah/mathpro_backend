const router = require('express-promise-router')();
const userAuthMiddleWare = require('../../service/authMiddleWares').authenticateUser;
const UserUploadControllerV2 = require('../../controllers/user/uploadV2').UserUploadControllerV2;
const { actorLimiter } = require('../../util/rateLimitPolicies');

const userUploadControllerV2 = new UserUploadControllerV2();

const userUploadLimit = actorLimiter(
  'upload:user-presigned-url',
  15,
  60 * 60 * 1000,
  { message: 'Too many upload requests. Please try again later.' }
);

router.route('/presigned-url')
    .post(userAuthMiddleWare, userUploadLimit, userUploadControllerV2.createPresignedUrl);

module.exports = router;
