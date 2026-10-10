const Controller = require('../base').Controller;
const ErrorHandler = require('../../util/errorHandler');
const presignedUploadService = require('../../util/presignedUploadService');
const { createPresignedUrl, uploadError } = require('../shared/presignedUpload');

class UploadControllerV2 extends Controller {
    constructor() {
        super();
    }

    createPresignedUrl = createPresignedUrl;

    deleteObject = async (req, res) => {
        const {
            key,
            public_url: publicUrl
        } = req.body;

        if (!key && !publicUrl) {
            throw ErrorHandler.validationError({
                key: 'key or public_url is required'
            });
        }

        const result = await presignedUploadService.deleteObject({
            key,
            publicUrl
        });

        if (!result.success) {
            throw uploadError(result, 400);
        }

        return res.status(200).json(result);
    };
}

module.exports = { UploadControllerV2 };
