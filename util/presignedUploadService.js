const path = require('path');
const crypto = require('crypto');
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { validateUploadInput } = require('./uploadPolicies');

function sanitizeBaseName(fileName) {
    const extension = path.extname(fileName);
    const baseName = path.basename(fileName, extension);

    const sanitized = baseName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();

    return sanitized || 'file';
}

function encodeS3KeyForUrl(key) {
    return key
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

class PresignedUploadService {
    constructor() {
        this.region = process.env.R2_REGION;
        this.bucket = process.env.R2_BUCKET;
        this.accountId = process.env.R2_ACCOUNT_ID;
        this.endpoint = process.env.R2_ENDPOINT || null;
        this.publicUrlBase = process.env.R2_PUBLIC_URL_BASE || null;
        this.client = null;
    }

    validateStorageConfig() {
        if (!this.bucket) {
            return {
                valid: false,
                code: 'UPLOAD_CONFIGURATION_ERROR',
                error: 'Storage bucket is not configured'
            };
        }

        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
            return {
                valid: false,
                code: 'UPLOAD_CONFIGURATION_ERROR',
                error: 'Storage credentials are incomplete'
            };
        }

        if (!this.endpoint && !this.accountId) {
            return {
                valid: false,
                code: 'UPLOAD_CONFIGURATION_ERROR',
                error: 'R2 endpoint or account id is missing'
            };
        }

        if (!this.publicUrlBase) {
            return {
                valid: false,
                code: 'UPLOAD_CONFIGURATION_ERROR',
                error: 'R2 public URL base is missing'
            };
        }

        return { valid: true };
    }

    getClient() {
        if (this.client) {
            return this.client;
        }

        const validation = this.validateStorageConfig();
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

        this.client = new S3Client({
            region: this.region || 'auto',
            endpoint: this.endpoint || `https://${this.accountId}.r2.cloudflarestorage.com`,
            forcePathStyle: true,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        });

        return this.client;
    }

    buildObjectKey(policy, fileName) {
        const extension = path.extname(fileName).toLowerCase();
        const safeBase = sanitizeBaseName(fileName);
        const now = Date.now();
        const randomSuffix = crypto.randomBytes(6).toString('hex');
        return `${policy.folder}/${now}_${randomSuffix}_${safeBase}${extension}`;
    }

    buildPublicUrl(key) {
        const encodedKey = encodeS3KeyForUrl(key);

        if (this.publicUrlBase) {
            const normalizedBase = this.publicUrlBase.endsWith('/') ? this.publicUrlBase : `${this.publicUrlBase}/`;
            return new URL(encodedKey, normalizedBase).toString();
        }

        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodedKey}`;
    }

    resolveObjectKey(identifier = {}) {
        const directKey = typeof identifier.key === 'string' ? identifier.key.trim() : '';
        if (directKey) {
            return {
                success: true,
                key: directKey
            };
        }

        const publicUrl = typeof identifier.publicUrl === 'string'
            ? identifier.publicUrl.trim()
            : '';

        if (!publicUrl) {
            return {
                success: false,
                code: 'INVALID_UPLOAD_IDENTIFIER',
                error: 'Object key or public URL is required'
            };
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(publicUrl);
        } catch (error) {
            return {
                success: false,
                code: 'INVALID_UPLOAD_IDENTIFIER',
                error: 'Public URL is invalid'
            };
        }

        if (this.publicUrlBase) {
            let baseUrl;
            try {
                baseUrl = new URL(this.publicUrlBase);
            } catch (error) {
                return {
                    success: false,
                    code: 'UPLOAD_CONFIGURATION_ERROR',
                    error: 'R2 public URL base is invalid'
                };
            }

            if (parsedUrl.origin !== baseUrl.origin) {
                return {
                    success: false,
                    code: 'INVALID_UPLOAD_IDENTIFIER',
                    error: 'Public URL does not match storage base URL'
                };
            }

            const basePath = baseUrl.pathname.endsWith('/')
                ? baseUrl.pathname
                : `${baseUrl.pathname}/`;
            const normalizedPath = parsedUrl.pathname;

            if (
                baseUrl.pathname !== '/' &&
                normalizedPath !== baseUrl.pathname &&
                !normalizedPath.startsWith(basePath)
            ) {
                return {
                    success: false,
                    code: 'INVALID_UPLOAD_IDENTIFIER',
                    error: 'Public URL does not match storage base URL'
                };
            }
        }

        const key = parsedUrl.pathname
            .split('/')
            .filter(Boolean)
            .map((segment) => decodeURIComponent(segment))
            .join('/');

        if (!key) {
            return {
                success: false,
                code: 'INVALID_UPLOAD_IDENTIFIER',
                error: 'Unable to derive storage key from public URL'
            };
        }

        return {
            success: true,
            key
        };
    }

    async createPresignedUpload({ purpose, fileName, contentType, contentLength }) {
        const storageValidation = this.validateStorageConfig();
        if (!storageValidation.valid) {
            return {
                success: false,
                error: storageValidation.error,
                code: storageValidation.code
            };
        }

        const validation = validateUploadInput(purpose, fileName, contentType, contentLength);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                code: validation.code
            };
        }

        const key = this.buildObjectKey(validation.policy, fileName);
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: validation.normalizedContentType
        });

        const expiresIn = 900;
        const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn });

        return {
            success: true,
            data: {
                purpose,
                key,
                upload_url: uploadUrl,
                method: 'PUT',
                content_type: validation.normalizedContentType,
                expires_in: expiresIn,
                public_url: this.buildPublicUrl(key),
                max_bytes: validation.policy.maxBytes
            }
        };
    }

    async deleteObject({ key, publicUrl }) {
        const storageValidation = this.validateStorageConfig();
        if (!storageValidation.valid) {
            return {
                success: false,
                error: storageValidation.error,
                code: storageValidation.code
            };
        }

        const resolvedKey = this.resolveObjectKey({ key, publicUrl });
        if (!resolvedKey.success) {
            return resolvedKey;
        }

        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: resolvedKey.key
        });

        await this.getClient().send(command);

        return {
            success: true,
            data: {
                key: resolvedKey.key
            }
        };
    }

    async getObjectText(key) {
        const storageValidation = this.validateStorageConfig();
        if (!storageValidation.valid) {
            throw new Error(storageValidation.error);
        }

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key
        });

        const response = await this.getClient().send(command);
        return response.Body.transformToString('utf-8');
    }
}

module.exports = new PresignedUploadService();
