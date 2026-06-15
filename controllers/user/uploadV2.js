const Controller = require('../base').Controller;
const ErrorHandler = require('../../util/errorHandler');
const presignedUploadService = require('../../util/presignedUploadService');

class UserUploadControllerV2 extends Controller {
    constructor() {
        super();
    }

    createPresignedUrl = async (req, res) => {
        try {
            const {
                purpose,
                file_name: fileName,
                content_type: contentType,
                content_length: contentLength
            } = req.body;

            if (!purpose) {
                const { response, statusCode } = ErrorHandler.validationError({
                    purpose: 'purpose is required'
                });
                return res.status(statusCode).json(response);
            }

            const result = await presignedUploadService.createPresignedUpload({
                purpose,
                fileName,
                contentType,
                contentLength
            });

            if (!result.success) {
                const status = result.code === 'UPLOAD_CONFIGURATION_ERROR' ? 500 : 422;
                const { response, statusCode } = ErrorHandler.createErrorResponse(
                    result.error,
                    result.code,
                    null,
                    status
                );
                return res.status(statusCode).json(response);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error in user createPresignedUrl:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    };
}

module.exports = { UserUploadControllerV2 };
