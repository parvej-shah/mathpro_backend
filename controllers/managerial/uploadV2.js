const Controller = require('../base').Controller;
const ErrorHandler = require('../../util/errorHandler');
const presignedUploadService = require('../../util/presignedUploadService');

class UploadControllerV2 extends Controller {
    constructor() {
        super();
    }

    createPresignedUrl = async (req, res) => {
        const {
            purpose,
            file_name: fileName,
            content_type: contentType,
            content_length: contentLength
        } = req.body;

        if (!purpose) {
            throw ErrorHandler.validationError({
                purpose: 'purpose is required'
            });
        }

        const result = await presignedUploadService.createPresignedUpload({
            purpose,
            fileName,
            contentType,
            contentLength
        });

        if (!result.success) {
            const status = result.code === 'UPLOAD_CONFIGURATION_ERROR' ? 500 : 422;
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                null,
                status
            );
        }

        return res.status(200).json(result);
    };

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
            const status = result.code === 'UPLOAD_CONFIGURATION_ERROR' ? 500 : 400;
            throw ErrorHandler.createErrorResponse(
                result.error,
                result.code,
                null,
                status
            );
        }

        return res.status(200).json(result);
    };
}

module.exports = { UploadControllerV2 };
