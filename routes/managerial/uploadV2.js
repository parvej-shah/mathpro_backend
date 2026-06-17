const router = require('express-promise-router')();
const adminAuthMiddleWare = require('../../service/authMiddleWares').authenticateAdmin;
const UploadControllerV2 = require('../../controllers/managerial/uploadV2').UploadControllerV2;

const uploadControllerV2 = new UploadControllerV2();

router.route('/presigned-url')
    .post(adminAuthMiddleWare, uploadControllerV2.createPresignedUrl);

router.route('/delete')
    .post(adminAuthMiddleWare, uploadControllerV2.deleteObject);

module.exports = router;
