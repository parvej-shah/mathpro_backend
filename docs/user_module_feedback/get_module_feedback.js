module.exports = {
    get: {
        tags: ['Module Feedback'],
        summary: 'Get user feedback for a module',
        description: 'Get the current user\'s feedback for a specific module',
        operationId: 'getModuleFeedback',
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
                description: 'Feedback retrieved successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: {
                                    type: 'object',
                                    nullable: true,
                                    properties: {
                                        id: { type: 'integer', example: 1 },
                                        module_id: { type: 'integer', example: 123 },
                                        user_id: { type: 'integer', example: 456 },
                                        reaction: { type: 'string', example: 'like' },
                                        reason: { type: 'string', nullable: true },
                                        comment: { type: 'string', nullable: true },
                                        created_at: { type: 'string', format: 'date-time' }
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

