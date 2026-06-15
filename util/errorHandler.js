/**
 * Consistent error response handler for Phase 8 APIs
 * Ensures all v2 endpoints return standardized error formats
 */

class ErrorHandler {
    /**
     * Create a standardized error response
     * @param {string} error - Human-readable error message
     * @param {string} code - Error code (e.g., 'MODULE_NOT_FOUND')
     * @param {object} details - Field-level validation errors
     * @param {number} statusCode - HTTP status code
     * @returns {object} Standardized error response
     */
    static createErrorResponse(error, code, details = null, statusCode = 400) {
        const response = {
            success: false,
            error: error,
            code: code,
            timestamp: new Date().toISOString()
        };

        if (details) {
            response.details = details;
        }

        return { response, statusCode };
    }

    /**
     * Handle validation errors with field-level details
     * @param {object} validationErrors - Object with field names as keys and error messages as values
     * @returns {object} Standardized validation error response
     */
    static validationError(validationErrors) {
        return this.createErrorResponse(
            'Validation failed',
            'VALIDATION_ERROR',
            validationErrors,
            422
        );
    }

    /**
     * Handle not found errors
     * @param {string} resource - Resource name (e.g., 'Module', 'Course')
     * @returns {object} Standardized not found error response
     */
    static notFound(resource) {
        return this.createErrorResponse(
            `${resource} not found`,
            `${resource.toUpperCase().replace(/\s/g, '_')}_NOT_FOUND`,
            null,
            404
        );
    }

    /**
     * Handle unauthorized errors
     * @returns {object} Standardized unauthorized error response
     */
    static unauthorized() {
        return this.createErrorResponse(
            'Authentication required',
            'UNAUTHORIZED',
            null,
            401
        );
    }

    /**
     * Handle forbidden errors
     * @returns {object} Standardized forbidden error response
     */
    static forbidden() {
        return this.createErrorResponse(
            'Insufficient permissions',
            'FORBIDDEN',
            null,
            403
        );
    }

    /**
     * Handle server errors
     * @param {string} message - Error message
     * @returns {object} Standardized server error response
     */
    static serverError(message = 'Internal server error') {
        return this.createErrorResponse(
            message,
            'INTERNAL_SERVER_ERROR',
            null,
            500
        );
    }
}

module.exports = ErrorHandler;
