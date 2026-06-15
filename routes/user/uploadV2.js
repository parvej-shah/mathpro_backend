const router = require('express-promise-router')();
const userAuthMiddleWare = require('../../service/authMiddleWares').authenticateUser;
const UserUploadControllerV2 = require('../../controllers/user/uploadV2').UserUploadControllerV2;

const userUploadControllerV2 = new UserUploadControllerV2();

router.route('/presigned-url')
    .post(userAuthMiddleWare, userUploadControllerV2.createPresignedUrl);

module.exports = router;
