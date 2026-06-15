module.exports = {
    get: {
        tags: ['Admin Module Feedback'],
        summary: 'Export module feedback as CSV',
        description: 'Export all module feedback data as a CSV file with optional filters',
        operationId: 'exportModuleFeedback',
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'courseId',
                in: 'query',
                required: false,
                schema: { type: 'integer' },
                description: 'Filter by course ID'
            },
            {
                name: 'reaction',
                in: 'query',
                required: false,
                schema: { type: 'string', enum: ['like', 'dislike'] },
                description: 'Filter by reaction type'
            }
        ],
        responses: {
            200: {
                description: 'CSV file downloaded',
                content: {
                    'text/csv': {
                        schema: {
                            type: 'string',
                            example: 'Module ID,Module Title,Chapter Title,Course Title,Reaction,Reason,Comment,User Name,Created At\n123,"Introduction","Getting Started","DSA Course",like,,,John Doe,2025-12-26T10:00:00Z'
                        }
                    }
                }
            },
            401: {
                description: 'Unauthorized'
            }
        }
    }
};

