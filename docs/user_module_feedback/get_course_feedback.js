module.exports = {
    get: {
        tags: ['Module Feedback'],
        summary: 'Get user feedback for all modules in a course',
        description: 'Get the current user\'s feedback for all modules in a specific course',
        operationId: 'getCourseFeedback',
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                name: 'courseId',
                in: 'path',
                required: true,
                schema: { type: 'integer' },
                description: 'ID of the course'
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
                                            reaction: { type: 'string', example: 'like' },
                                            reason: { type: 'string', nullable: true },
                                            comment: { type: 'string', nullable: true },
                                            created_at: { type: 'string', format: 'date-time' }
                                        }
                                    }
                                },
                                count: { type: 'integer', example: 15 }
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

