// Handlers shared by the admin and student V2 upload controllers.
const ErrorHandler = require('../../util/errorHandler');
const presignedUploadService = require('../../util/presignedUploadService');

// A failed upload-service result as a V2 error: missing storage config is our fault (500),
// anything else is the request's (`clientStatus`).
const uploadError = (result, clientStatus) => ErrorHandler.createErrorResponse(
    result.error,
    result.code,
    null,
    result.code === 'UPLOAD_CONFIGURATION_ERROR' ? 500 : clientStatus
);

const createPresignedUrl = async (req, res) => {
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
        throw uploadError(result, 422);
    }

    return res.status(200).json(result);
};

module.exports = { createPresignedUrl, uploadError };
