const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
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
        this.region = process.env.AWS_REGION;
        this.bucket = process.env.AWS_BUCKET;
        this.client = null;
    }

    validateAwsConfig() {
        if (!this.region || !this.bucket || !process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_KEY) {
            return {
                valid: false,
                code: 'UPLOAD_CONFIGURATION_ERROR',
                error: 'AWS upload configuration is incomplete'
            };
        }
        return { valid: true };
    }

    getClient() {
        if (this.client) {
            return this.client;
        }

        const validation = this.validateAwsConfig();
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        this.client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY,
                secretAccessKey: process.env.AWS_SECRET_KEY
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
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodedKey}`;
    }

    async createPresignedUpload({ purpose, fileName, contentType, contentLength }) {
        const awsValidation = this.validateAwsConfig();
        if (!awsValidation.valid) {
            return {
                success: false,
                error: awsValidation.error,
                code: awsValidation.code
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

    async getObjectText(key) {
        const awsValidation = this.validateAwsConfig();
        if (!awsValidation.valid) {
            throw new Error(awsValidation.error);
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
