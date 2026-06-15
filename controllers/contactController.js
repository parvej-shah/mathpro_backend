const Controller = require('./base').Controller;
const ContactService = require('../service/contactService').ContactService;
const { RateLimiter } = require('limiter');

class ContactController extends Controller {
    constructor() {
        super();
        this.contactService = new ContactService();
        
        // Initialize rate limiter: 3 requests per hour per IP
        this.rateLimiter = new RateLimiter({
            tokensPerInterval: 3,
            interval: 'hour'
        });
    }

    /**
     * Rate limiting middleware for contact form submissions
     * Checks rate limit based on IP address
     */
    rateLimitMiddleware = async (req, res, next) => {
        try {
            const ipAddress = this.contactService.getClientIp(req);
            
            // Remove rate limiter check for localhost/development
            if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'unknown') {
                return next();
            }

            // Check rate limit
            const remaining = await this.rateLimiter.removeTokens(1);
            
            if (remaining < 0) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests',
                    message: 'You have exceeded the maximum number of submissions. Please try again later.',
                    retryAfter: '1 hour'
                });
            }

            // Add remaining requests to response headers
            res.setHeader('X-RateLimit-Remaining', Math.floor(remaining));
            res.setHeader('X-RateLimit-Limit', 3);
            res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 3600000).toISOString());

            next();
        } catch (error) {
            console.error('Rate limiter error:', error);
            // On error, allow the request (fail open)
            next();
        }
    }

    /**
     * Submit contact form
     * POST /api/contact
     */
    submitContact = async (req, res) => {
        try {
            const result = await this.contactService.createSubmission(req.body, req);
            
            if (!result.success) {
                return res.status(result.errors ? 400 : 500).json({
                    success: false,
                    error: result.error || 'Internal server error',
                    ...(result.errors && { errors: result.errors }),
                    message: result.error === 'Validation failed' 
                        ? 'Please check your input and try again.'
                        : 'An error occurred while processing your request. Please try again later.'
                });
            }

            return res.status(201).json({
                success: true,
                message: 'Thank you for your inquiry. We will contact you soon.',
                data: result.data
            });
        } catch (error) {
            console.error('Error in submitContact:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: 'An error occurred while processing your request. Please try again later.'
            });
        }
    }

    /**
     * Get all contact submissions (Admin only)
     * GET /api/contact
     */
    getAllSubmissions = async (req, res) => {
        try {
            const { status, limit, offset } = req.query;
            const filters = {
                status: status || null,
                limit: limit ? parseInt(limit) : 50,
                offset: offset ? parseInt(offset) : 0
            };

            const result = await this.contactService.getAllSubmissions(filters);
            
            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error || 'Internal server error'
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Error in getAllSubmissions:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Get single contact submission by ID (Admin only)
     * GET /api/contact/:id
     */
    getSubmissionById = async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid submission ID'
                });
            }

            const result = await this.contactService.getSubmissionById(id);
            
            if (!result.success) {
                return res.status(result.error === 'Submission not found' ? 404 : 500).json({
                    success: false,
                    error: result.error || 'Internal server error'
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Error in getSubmissionById:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Update submission status (Admin only)
     * PUT /api/contact/:id/status
     */
    updateSubmissionStatus = async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const { status } = req.body;
            
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid submission ID'
                });
            }

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }

            const result = await this.contactService.updateSubmissionStatus(id, status);
            
            if (!result.success) {
                return res.status(result.error === 'Submission not found or update failed' ? 404 : 400).json({
                    success: false,
                    error: result.error || 'Internal server error'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Status updated successfully',
                data: result.data
            });
        } catch (error) {
            console.error('Error in updateSubmissionStatus:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
}

module.exports = { ContactController };

