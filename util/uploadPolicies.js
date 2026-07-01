const path = require('path');

const MB = 1024 * 1024;

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const webpExtensions = ['.webp'];
const webpMimeTypes = ['image/webp'];

const documentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md'];
const documentMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
];

const codeExtensions = ['.js', '.ts', '.py', '.java', '.c', '.cpp', '.json', '.csv'];
const codeMimeTypes = [
    'application/json',
    'text/csv',
    'text/plain',
    'application/javascript',
    'text/javascript'
];

const archiveExtensions = ['.zip'];
const archiveMimeTypes = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

const uploadPolicies = {
    'teacher-image': {
        folder: 'teachers',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'routine-image': {
        folder: 'routines',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'live-class-thumbnail': {
        folder: 'live-classes',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'course-thumbnail': {
        folder: 'courses/thumbnails',
        maxBytes: 10 * MB,
        allowedExtensions: imageExtensions,
        allowedMimeTypes: imageMimeTypes
    },
    'course-thumbnail-card': {
        folder: 'courses/thumbnails/card',
        maxBytes: 300 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'course-thumbnail-banner': {
        folder: 'courses/thumbnails/banner',
        maxBytes: 250 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'bundle-thumbnail-card': {
        folder: 'bundles/thumbnails/card',
        maxBytes: 300 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'bundle-thumbnail-banner': {
        folder: 'bundles/thumbnails/banner',
        maxBytes: 250 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'course-instructor-image': {
        folder: 'courses/instructors',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'course-feedback-image': {
        folder: 'courses/feedbacks',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'contest-thumbnail': {
        folder: 'contests',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'announcement-attachment': {
        folder: 'announcements',
        maxBytes: 10 * MB,
        allowedExtensions: documentExtensions,
        allowedMimeTypes: documentMimeTypes
    },
    'announcement-image': {
        folder: 'announcements',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'quiz-image': {
        folder: 'quizzes/images',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    },
    'assignment-document': {
        folder: 'assignments',
        maxBytes: 25 * MB,
        allowedExtensions: [...documentExtensions, ...imageExtensions, ...archiveExtensions, ...codeExtensions],
        allowedMimeTypes: [...documentMimeTypes, ...imageMimeTypes, ...archiveMimeTypes, ...codeMimeTypes]
    },
    'module-pdf': {
        folder: 'modules/pdf',
        maxBytes: 25 * MB,
        allowedExtensions: ['.pdf'],
        allowedMimeTypes: ['application/pdf']
    },
    'course-outline': {
        folder: 'courses/outlines',
        maxBytes: 25 * MB,
        allowedExtensions: ['.pdf'],
        allowedMimeTypes: ['application/pdf']
    },
    'module-video-attachment': {
        folder: 'modules/video-attachments',
        maxBytes: 25 * MB,
        allowedExtensions: [...documentExtensions, ...imageExtensions, ...archiveExtensions],
        allowedMimeTypes: [...documentMimeTypes, ...imageMimeTypes, ...archiveMimeTypes]
    },
    'module-code-file': {
        folder: 'modules/code-files',
        maxBytes: 25 * MB,
        allowedExtensions: [...codeExtensions, ...documentExtensions, ...archiveExtensions],
        allowedMimeTypes: [...codeMimeTypes, ...documentMimeTypes, ...archiveMimeTypes]
    },
    'course-import': {
        folder: 'imports/courses',
        maxBytes: 50 * MB,
        allowedExtensions: ['.csv', '.json'],
        allowedMimeTypes: ['text/csv', 'application/json', 'application/octet-stream']
    },
    'book-cover': {
        folder: 'books/covers',
        maxBytes: 200 * 1024,
        allowedExtensions: webpExtensions,
        allowedMimeTypes: webpMimeTypes
    }
};

function getUploadPolicy(purpose) {
    return uploadPolicies[purpose] || null;
}

function validateUploadInput(purpose, fileName, contentType, contentLength) {
    const policy = getUploadPolicy(purpose);
    if (!policy) {
        return {
            valid: false,
            code: 'INVALID_UPLOAD_PURPOSE',
            error: `Unsupported upload purpose: ${purpose}`
        };
    }

    if (!fileName || typeof fileName !== 'string') {
        return {
            valid: false,
            code: 'VALIDATION_ERROR',
            error: 'file_name is required'
        };
    }

    if (!contentType || typeof contentType !== 'string') {
        return {
            valid: false,
            code: 'VALIDATION_ERROR',
            error: 'content_type is required'
        };
    }

    const parsedLength = Number(contentLength);
    if (!Number.isFinite(parsedLength) || parsedLength <= 0) {
        return {
            valid: false,
            code: 'VALIDATION_ERROR',
            error: 'content_length must be a positive number'
        };
    }

    if (parsedLength > policy.maxBytes) {
        const limitLabel = policy.maxBytes >= MB
            ? `${Math.round(policy.maxBytes / MB)}MB`
            : `${Math.round(policy.maxBytes / 1024)}KB`;
        return {
            valid: false,
            code: 'FILE_TOO_LARGE',
            error: `File size exceeds ${limitLabel} limit`
        };
    }

    const extension = path.extname(fileName).toLowerCase();
    if (!policy.allowedExtensions.includes(extension)) {
        return {
            valid: false,
            code: 'INVALID_FILE_TYPE',
            error: `Invalid file extension: ${extension || '(none)'}`
        };
    }

    const normalizedContentType = contentType.toLowerCase().trim();
    if (!policy.allowedMimeTypes.includes(normalizedContentType)) {
        return {
            valid: false,
            code: 'INVALID_FILE_TYPE',
            error: `Invalid content type: ${contentType}`
        };
    }

    return {
        valid: true,
        policy,
        normalizedContentType,
        parsedLength
    };
}

module.exports = {
    getUploadPolicy,
    validateUploadInput
};
