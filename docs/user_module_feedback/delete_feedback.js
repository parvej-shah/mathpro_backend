module.exports = {
    delete: {
        tags: ['Module Feedback'],
        summary: 'Delete module feedback',
        description: 'Delete the current user\'s feedback for a specific module',
        operationId: 'deleteModuleFeedback',
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
                description: 'Feedback deleted successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                message: { type: 'string', example: 'Feedback deleted successfully' }
                            }
                        }
                    }
                }
            },
            404: {
                description: 'Feedback not found',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { type: 'string', example: 'Feedback not found' }
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

