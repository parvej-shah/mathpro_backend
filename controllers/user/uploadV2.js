const Controller = require('../base').Controller;
const { createPresignedUrl } = require('../shared/presignedUpload');

class UserUploadControllerV2 extends Controller {
    constructor() {
        super();
    }

    createPresignedUrl = createPresignedUrl;
}

module.exports = { UserUploadControllerV2 };
