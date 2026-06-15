module.exports = {
    get: {
        tags: ['Admin Module Feedback'],
        summary: 'Get all module feedback',
        description: 'Get all module feedback with optional filters for course, module, reaction, and reason',
        operationId: 'getAllModuleFeedback',
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
                name: 'moduleId',
                in: 'query',
                required: false,
                schema: { type: 'integer' },
                description: 'Filter by module ID'
            },
            {
                name: 'reaction',
                in: 'query',
                required: false,
                schema: { type: 'string', enum: ['like', 'dislike'] },
                description: 'Filter by reaction type'
            },
            {
                name: 'reason',
                in: 'query',
                required: false,
                schema: { 
                    type: 'string',
                    enum: ['too_fast', 'too_slow', 'unclear', 'outdated', 'audio_issue', 'video_issue', 'missing_content', 'too_difficult', 'too_easy', 'other']
                },
                description: 'Filter by reason'
            },
            {
                name: 'page',
                in: 'query',
                required: false,
                schema: { type: 'integer', default: 1 },
                description: 'Page number'
            },
            {
                name: 'limit',
                in: 'query',
                required: false,
                schema: { type: 'integer', default: 20 },
                description: 'Items per page'
            }
        ],
        responses: {
            200: {
                description: 'Feedback retrieved successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'integer', example: 1 },
                                            module_id: { type: 'integer', example: 123 },
                                            module_title: { type: 'string', example: 'Introduction to Recursion' },
                                            chapter_title: { type: 'string', example: 'Advanced Topics' },
                                            course_title: { type: 'string', example: 'Data Structures' },
                                            reaction: { type: 'string', example: 'dislike' },
                                            reason: { type: 'string', example: 'unclear' },
                                            comment: { type: 'string', example: 'Confusing explanation' },
                                            user_name: { type: 'string', example: 'John Doe' },
                                            user_login: { type: 'string', example: '01712345678' },
                                            created_at: { type: 'string', format: 'date-time' }
                                        }
                                    }
                                },
                                pagination: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'integer', example: 150 },
                                        page: { type: 'integer', example: 1 },
                                        limit: { type: 'integer', example: 20 },
                                        totalPages: { type: 'integer', example: 8 }
                                    }
                                }
                            }
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

