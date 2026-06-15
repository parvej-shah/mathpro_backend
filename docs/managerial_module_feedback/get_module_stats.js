module.exports = {
    get: {
        tags: ['Admin Module Feedback'],
        summary: 'Get module feedback stats',
        description: 'Get detailed feedback statistics for a specific module including like/dislike counts, reason breakdown, and recent comments',
        operationId: 'getAdminModuleStats',
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'moduleId',
                in: 'path',
                required: true,
                schema: { type: 'integer' },
                description: 'ID of the module'
            }
        ],
        responses: {
            200: {
                description: 'Stats retrieved successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: {
                                    type: 'object',
                                    properties: {
                                        module_id: { type: 'integer', example: 123 },
                                        likes: { type: 'integer', example: 45 },
                                        dislikes: { type: 'integer', example: 5 },
                                        total: { type: 'integer', example: 50 },
                                        like_percentage: { type: 'integer', example: 90 },
                                        dislike_reasons: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    reason: { type: 'string', example: 'unclear' },
                                                    count: { type: 'integer', example: 3 }
                                                }
                                            }
                                        },
                                        recent_comments: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    reaction: { type: 'string', example: 'dislike' },
                                                    reason: { type: 'string', example: 'unclear' },
                                                    comment: { type: 'string', example: 'The recursion example was confusing' },
                                                    user_name: { type: 'string', example: 'John Doe' },
                                                    created_at: { type: 'string', format: 'date-time' }
                                                }
                                            }
                                        }
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

