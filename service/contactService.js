const Service = require('./base').Service;
const MessagingService = require('./messagingService').MessagingService;

class ContactService extends Service {
    constructor() {
        super();
        this.messagingService = new MessagingService();
        this.table = 'contact_submissions';
    }

    /**
     * Validates email format
     * @param {string} email - Email address to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    validateEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Validates and normalizes WhatsApp number
     * Accepts various formats and normalizes to international format
     * @param {string} phone - Phone number to validate
     * @returns {object} - { valid: boolean, normalized: string }
     */
    validateWhatsAppNumber(phone) {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, normalized: null };
        }

        // Remove all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');

        // If starts with +, keep it; otherwise try to detect country code
        if (cleaned.startsWith('+')) {
            // Already has country code
            if (cleaned.length >= 10 && cleaned.length <= 15) {
                return { valid: true, normalized: cleaned };
            }
        } else {
            // Try to detect Bangladesh number (880)
            if (cleaned.startsWith('880') && cleaned.length === 13) {
                return { valid: true, normalized: '+' + cleaned };
            }
            // Try to detect Bangladesh number without country code (01XXXXXXXXX)
            if (cleaned.startsWith('01') && cleaned.length === 11) {
                return { valid: true, normalized: '+880' + cleaned };
            }
            // If it's 10-15 digits, assume it has country code but missing +
            if (cleaned.length >= 10 && cleaned.length <= 15) {
                return { valid: true, normalized: '+' + cleaned };
            }
        }

        return { valid: false, normalized: null };
    }

    /**
     * Validates full name
     * @param {string} name - Name to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    validateFullName(name) {
        if (!name || typeof name !== 'string') return false;
        const trimmed = name.trim();
        return trimmed.length >= 2 && trimmed.length <= 100;
    }

    /**
     * Validates project details
     * @param {string} details - Project details to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    validateProjectDetails(details) {
        if (!details || typeof details !== 'string') return false;
        const trimmed = details.trim();
        return trimmed.length >= 10 && trimmed.length <= 2000;
    }

    /**
     * Sanitizes input to prevent XSS attacks
     * @param {string} input - Input string to sanitize
     * @returns {string} - Sanitized string
     */
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';
        return input
            .trim()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Validates all contact form fields
     * @param {object} data - Contact form data
     * @returns {object} - { valid: boolean, errors: object }
     */
    validateContactData(data) {
        const errors = {};

        // Validate full name
        if (!this.validateFullName(data.fullName)) {
            errors.fullName = 'Full name must be between 2 and 100 characters';
        }

        // Validate email
        if (!this.validateEmail(data.email)) {
            errors.email = 'Invalid email format';
        }

        // Validate WhatsApp number
        const phoneValidation = this.validateWhatsAppNumber(data.whatsappNumber);
        if (!phoneValidation.valid) {
            errors.whatsappNumber = 'Invalid phone number format. Please include country code (e.g., +880 1712 345678)';
        }

        // Validate project details
        if (!this.validateProjectDetails(data.projectDetails)) {
            errors.projectDetails = 'Project details must be between 10 and 2000 characters';
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors,
            normalizedData: phoneValidation.valid ? {
                ...data,
                whatsappNumber: phoneValidation.normalized
            } : data
        };
    }

    /**
     * Gets client IP address from request
     * Handles Cloudflare and proxy headers
     * @param {object} req - Express request object
     * @returns {string} - IP address
     */
    getClientIp(req) {
        // Check Cloudflare headers first
        const cfConnectingIp = req.headers['cf-connecting-ip'];
        if (cfConnectingIp) return cfConnectingIp;

        // Check X-Forwarded-For header (for proxies)
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
            // X-Forwarded-For can contain multiple IPs, take the first one
            return xForwardedFor.split(',')[0].trim();
        }

        // Check X-Real-IP header
        const xRealIp = req.headers['x-real-ip'];
        if (xRealIp) return xRealIp;

        // Fallback to req.ip or req.connection.remoteAddress
        return req.ip || req.connection?.remoteAddress || 'unknown';
    }

    /**
     * Creates a new contact submission
     * @param {object} data - Contact form data
     * @param {object} req - Express request object
     * @returns {object} - { success: boolean, data: object, error: string }
     */
    createSubmission = async (data, req) => {
        try {
            // Validate input data
            const validation = this.validateContactData(data);
            if (!validation.valid) {
                return {
                    success: false,
                    error: 'Validation failed',
                    errors: validation.errors
                };
            }

            // Sanitize inputs (except email and phone which are validated)
            const sanitizedData = {
                fullName: this.sanitizeInput(validation.normalizedData.fullName),
                email: validation.normalizedData.email.trim().toLowerCase(),
                whatsappNumber: validation.normalizedData.whatsappNumber,
                projectDetails: this.sanitizeInput(validation.normalizedData.projectDetails)
            };

            // Get IP address and user agent
            const ipAddress = this.getClientIp(req);
            const userAgent = req.headers['user-agent'] || null;

            // Insert into database
            const query = `
                INSERT INTO ${this.table} 
                (full_name, email, whatsapp_number, project_details, ip_address, user_agent, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, created_at
            `;
            const params = [
                sanitizedData.fullName,
                sanitizedData.email,
                sanitizedData.whatsappNumber,
                sanitizedData.projectDetails,
                ipAddress,
                userAgent,
                'new'
            ];

            const result = await this.query(query, params);

            if (!result.success || !result.data || result.data.length === 0) {
                return {
                    success: false,
                    error: 'Failed to save submission'
                };
            }

            const submission = result.data[0];

            // Send emails asynchronously (don't await - let them run in background)
            this.sendNotificationEmails(sanitizedData, submission.id).catch(err => {
                console.error('Error sending notification emails:', err);
            });

            return {
                success: true,
                data: {
                    id: `contact_${submission.id}`,
                    submittedAt: submission.created_at
                }
            };
        } catch (error) {
            console.error('Error creating contact submission:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    }

    /**
     * Sends notification emails (admin notification + auto-reply)
     * @param {object} data - Contact form data
     * @param {number} submissionId - Submission ID
     */
    async sendNotificationEmails(data, submissionId) {
        const adminEmail = process.env.CONTACT_ADMIN_EMAIL || 'emran.a.mostofa@gmail.com';

        // Send admin notification email
        const adminEmailHtml = this.getAdminNotificationEmailTemplate(data, submissionId);
        await this.messagingService.sendMail(
            adminEmail,
            `Math Pro LP - New Contact Form Submission - ${data.fullName}`,
            adminEmailHtml
        ).catch(err => console.error('Admin email error:', err));

        // Send auto-reply confirmation email
        const autoReplyHtml = this.getAutoReplyEmailTemplate(data.fullName);
        await this.messagingService.sendMail(
            data.email,
            'Thank you for contacting Math Pro',
            autoReplyHtml
        ).catch(err => console.error('Auto-reply email error:', err));
    }

    /**
     * Generates HTML template for admin notification email
     * @param {object} data - Contact form data
     * @param {number} submissionId - Submission ID
     * @returns {string} - HTML email template
     */
    getAdminNotificationEmailTemplate(data, submissionId) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Contact Form Submission - Math Pro</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            -webkit-font-smoothing: antialiased;
            color: #09090b;
            line-height: 1.5;
        }
        a {
            text-decoration: none;
            color: #2563eb;
        }
        a:hover {
            text-decoration: underline;
        }
        .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f9fafb;
            padding-bottom: 40px;
        }
        .main-content {
            background-color: #ffffff;
            margin: 0 auto;
            width: 100%;
            max-width: 600px;
            border-radius: 8px;
            border: 1px solid #e4e4e7;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            overflow: hidden;
        }
        .header {
            padding: 32px 32px 24px 32px;
            text-align: center;
            border-bottom: 1px solid #f4f4f5;
        }
        .logo {
            max-height: 40px;
            width: auto;
            margin-bottom: 16px;
        }
        .title {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.5px;
            margin: 0;
            color: #18181b;
        }
        .badge {
            display: inline-block;
            background-color: #f4f4f5;
            color: #18181b;
            font-size: 12px;
            font-weight: 500;
            padding: 4px 10px;
            border-radius: 9999px;
            border: 1px solid #e4e4e7;
            margin-top: 12px;
        }
        .content {
            padding: 32px;
        }
        .field-group {
            margin-bottom: 24px;
        }
        .label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #71717a;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .value {
            font-size: 16px;
            color: #09090b;
            font-weight: 400;
        }
        .message-box {
            background-color: #f9fafb;
            border: 1px solid #e4e4e7;
            border-radius: 6px;
            padding: 16px;
            font-size: 15px;
            color: #27272a;
            white-space: pre-wrap;
        }
        .btn, .btn-secondary {
            display: inline-block;
            font-size: 14px;
            font-weight: 500;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            margin-top: 8px;
            margin-bottom: 8px;
        }
        .btn {
            background-color: #18181b;
            color: #ffffff !important;
            border: 1px solid #18181b;
        }
        .btn:hover {
            background-color: #27272a;
            border-color: #27272a;
            text-decoration: none;
        }
        .btn-secondary {
            background-color: #ffffff;
            color: #18181b !important;
            border: 1px solid #e4e4e7;
        }
        .btn-secondary:hover {
            background-color: #f4f4f5;
            border-color: #e4e4e7;
            text-decoration: none;
        }
        .footer {
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #a1a1aa;
            background-color: #f9fafb;
            border-top: 1px solid #e4e4e7;
        }
        @media only screen and (max-width: 600px) {
            .main-content {
                width: 100% !important;
                border-radius: 0 !important;
                border-left: none !important;
                border-right: none !important;
            }
            .content {
                padding: 24px !important;
            }
        }
    </style>
</head>
<body>
    <center class="wrapper">
        <div style="height: 40px;"></div>
        <div class="main-content">
            <div class="header">
                <img src="https://image.mathpro.com/dark.png" alt="Math Pro Logo" class="logo">
                <h1 class="title">New Inquiry Received</h1>
                <div class="badge">
                    ID: #${submissionId}
                </div>
            </div>
            <div class="content">
                <div class="field-group">
                    <span class="label">From</span>
                    <div class="value">${data.fullName}</div>
                </div>
                <div class="field-group">
                    <span class="label">Email Address</span>
                    <div class="value">
                        <a href="mailto:${data.email}" style="color: #09090b; text-decoration: underline; text-decoration-color: #e4e4e7; text-underline-offset: 4px;">
                            ${data.email}
                        </a>
                    </div>
                </div>
                <div class="field-group">
                    <span class="label">WhatsApp</span>
                    <div class="value">
                        <a href="https://wa.me/${data.whatsappNumber.replace(/[^0-9]/g, '')}" style="color: #09090b; text-decoration: none;">
                            <span style="vertical-align: middle; margin-right: 4px; color: #25D366;">●</span> 
                            ${data.whatsappNumber}
                        </a>
                    </div>
                </div>
                <div class="field-group" style="margin-top: 32px;">
                    <span class="label" style="margin-bottom: 12px;">Project Details</span>
                    <div class="message-box">
                        ${data.projectDetails
                .replace(/\r\n/g, '\n')  // Normalize line endings
                .replace(/\r/g, '\n')     // Handle old Mac line endings
                .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
                .replace(/[ \t]+/g, ' ')  // Replace multiple spaces/tabs with single space
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('<br>')}
                    </div>
                </div>
                <div style="text-align: center; margin-top: 32px;">
                    <a href="mailto:${data.email}" class="btn">Reply via Email</a>
                    <span style="display: inline-block; width: 8px;"></span>
                    <a href="https://wa.me/${data.whatsappNumber.replace(/[^0-9]/g, '')}" class="btn-secondary">Reply via WhatsApp</a>
                </div>
            </div>
            <div class="footer">
                <p style="margin: 0 0 8px 0;">This is an automated notification from Math Pro Contact Form System.</p>
                <p style="margin: 0;">Please respond to the inquiry as soon as possible.</p>
            </div>
        </div>
        <div style="height: 40px;"></div>
    </center>
</body>
</html>
        `;
    }

    /**
     * Generates HTML template for auto-reply confirmation email
     * @param {string} name - Submitter's name
     * @returns {string} - HTML email template
     */
    getAutoReplyEmailTemplate(name) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>We've received your message - Math Pro</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            -webkit-font-smoothing: antialiased;
            color: #09090b;
            line-height: 1.6;
        }
        .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f9fafb;
            padding-bottom: 40px;
        }
        .main-content {
            background-color: #ffffff;
            margin: 0 auto;
            width: 100%;
            max-width: 600px;
            border-radius: 8px;
            border: 1px solid #e4e4e7;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            overflow: hidden;
            text-align: left;
        }
        .header {
            padding: 40px 40px 24px 40px;
            border-bottom: 1px solid #f4f4f5;
            text-align: center;
        }
        .logo {
            height: 32px;
            width: auto;
            margin-bottom: 0;
        }
        .content {
            padding: 40px;
        }
        h1 {
            font-size: 24px;
            font-weight: 600;
            letter-spacing: -0.5px;
            color: #18181b;
            margin-top: 0;
            margin-bottom: 24px;
        }
        p {
            margin-top: 0;
            margin-bottom: 24px;
            font-size: 16px;
            color: #3f3f46;
        }
        strong {
            font-weight: 600;
            color: #18181b;
        }
        .btn {
            display: inline-block;
            background-color: #18181b;
            color: #ffffff !important;
            font-size: 14px;
            font-weight: 500;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            margin-top: 10px;
        }
        .btn:hover {
            background-color: #27272a;
        }
        .divider {
            height: 1px;
            background-color: #e4e4e7;
            margin: 32px 0;
            border: none;
        }
        .footer {
            padding: 24px 40px;
            text-align: center;
            font-size: 13px;
            color: #a1a1aa;
            background-color: #f9fafb;
            border-top: 1px solid #e4e4e7;
        }
        .footer a {
            color: #71717a;
            text-decoration: underline;
        }
        @media only screen and (max-width: 600px) {
            .main-content {
                width: 100% !important;
                border-radius: 0 !important;
                border-left: none !important;
                border-right: none !important;
            }
            .content {
                padding: 32px 24px !important;
            }
            .header {
                padding: 32px 24px !important;
            }
        }
    </style>
</head>
<body>
    <center class="wrapper">
        <div style="height: 40px;"></div>
        <div class="main-content">
            <div class="header">
                <a href="https://mathpro.com" target="_blank">
                    <img src="https://image.mathpro.com/dark.png" alt="Math Pro" class="logo">
                </a>
            </div>
            <div class="content">
                <h1>Dear ${name},</h1>
                <p>Thanks for reaching out! We have <strong>successfully received</strong> your message and our team is already reviewing the details.</p>
                <p>We know your time is valuable. You can expect a personal response from a team member within <strong>24 hours</strong>.</p>
                <p>In the meantime, feel free to browse our latest work or explore our services on our website. We are excited about the possibility of <strong>working together</strong>.</p>
                <div style="margin-top: 32px; margin-bottom: 32px;">
                    <a href="https://mathpro.com" class="btn">Return to Math Pro</a>
                </div>
                <hr class="divider">
                <p style="margin-bottom: 0; font-size: 14px;">
                    Best regards,<br>
                    <strong>The Math Pro Team</strong>
                </p>
            </div>
            <div class="footer">
                <p style="margin: 0 0 8px 0;">© Math Pro. All rights reserved.</p>
                <p style="margin: 0;">This is an automated confirmation, but a real human will be with you shortly.</p>
            </div>
        </div>
        <div style="height: 40px;"></div>
    </center>
</body>
</html>
        `;
    }

    /**
     * Gets all contact submissions (for admin)
     * @param {object} filters - Optional filters (status, limit, offset)
     * @returns {object} - { success: boolean, data: array }
     */
    getAllSubmissions = async (filters = {}) => {
        try {
            const { status, limit = 50, offset = 0 } = filters;
            let query = `SELECT id, full_name, email, whatsapp_number, project_details, status, created_at, updated_at 
                        FROM ${this.table}`;
            const params = [];
            let paramIndex = 1;

            if (status) {
                query += ` WHERE status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);

            const result = await this.query(query, params);

            if (!result.success) {
                return {
                    success: false,
                    error: 'Failed to fetch submissions'
                };
            }

            // Get total count
            let countQuery = `SELECT COUNT(*) as total FROM ${this.table}`;
            const countParams = [];
            if (status) {
                countQuery += ` WHERE status = $1`;
                countParams.push(status);
            }
            const countResult = await this.query(countQuery, countParams);
            const total = countResult.success && countResult.data.length > 0
                ? parseInt(countResult.data[0].total)
                : 0;

            return {
                success: true,
                data: result.data.map(submission => ({
                    id: `contact_${submission.id}`,
                    fullName: submission.full_name,
                    email: submission.email,
                    whatsappNumber: submission.whatsapp_number,
                    projectDetails: submission.project_details,
                    status: submission.status,
                    submittedAt: submission.created_at,
                    updatedAt: submission.updated_at
                })),
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + result.data.length < total
                }
            };
        } catch (error) {
            console.error('Error fetching contact submissions:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    }

    /**
     * Gets a single contact submission by ID (for admin)
     * @param {number} id - Submission ID
     * @returns {object} - { success: boolean, data: object }
     */
    getSubmissionById = async (id) => {
        try {
            const query = `SELECT * FROM ${this.table} WHERE id = $1`;
            const result = await this.query(query, [id]);

            if (!result.success || !result.data || result.data.length === 0) {
                return {
                    success: false,
                    error: 'Submission not found'
                };
            }

            const submission = result.data[0];
            return {
                success: true,
                data: {
                    id: `contact_${submission.id}`,
                    fullName: submission.full_name,
                    email: submission.email,
                    whatsappNumber: submission.whatsapp_number,
                    projectDetails: submission.project_details,
                    ipAddress: submission.ip_address,
                    userAgent: submission.user_agent,
                    status: submission.status,
                    submittedAt: submission.created_at,
                    updatedAt: submission.updated_at
                }
            };
        } catch (error) {
            console.error('Error fetching contact submission:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    }

    /**
     * Updates submission status (for admin)
     * @param {number} id - Submission ID
     * @param {string} status - New status ('new', 'read', 'replied')
     * @returns {object} - { success: boolean, data: object }
     */
    updateSubmissionStatus = async (id, status) => {
        try {
            const validStatuses = ['new', 'read', 'replied'];
            if (!validStatuses.includes(status)) {
                return {
                    success: false,
                    error: 'Invalid status. Must be one of: new, read, replied'
                };
            }

            const query = `
                UPDATE ${this.table} 
                SET status = $1, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $2 
                RETURNING *
            `;
            const result = await this.query(query, [status, id]);

            if (!result.success || !result.data || result.data.length === 0) {
                return {
                    success: false,
                    error: 'Submission not found or update failed'
                };
            }

            return {
                success: true,
                data: {
                    id: `contact_${result.data[0].id}`,
                    status: result.data[0].status,
                    updatedAt: result.data[0].updated_at
                }
            };
        } catch (error) {
            console.error('Error updating submission status:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    }
}

module.exports = { ContactService };

