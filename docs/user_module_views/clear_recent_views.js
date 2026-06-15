module.exports = {
    delete: {
        tags: ['Module Views'],
        summary: 'Clear recent views',
        description: 'Clear all recent view history for the specified course only. This is an optional utility endpoint that deletes all stored module views for the authenticated user in the specified course.',
        operationId: 'clearRecentModuleViews',
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                in: 'path',
                name: 'courseId',
                required: true,
                schema: {
                    type: 'integer'
                },
                description: 'The course ID to clear recent views for',
                example: 11
            }
        ],
        responses: {
            200: {
                description: 'Recent views cleared successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                message: { type: 'string', example: 'Recent views cleared successfully' },
                                data: {
                                    type: 'object',
                                    properties: {
                                        courseId: { type: 'integer', example: 11 },
                                        deletedCount: { type: 'integer', description: 'Number of records deleted', example: 7 }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Bad Request - Invalid courseId',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { type: 'string', example: 'Valid courseId is required' }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Unauthorized - Missing or invalid authentication token',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { type: 'string', example: 'Authentication required' }
                            }
                        }
                    }
                }
            },
            403: {
                description: 'Forbidden - User is not enrolled in the specified course',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { type: 'string', example: 'User is not enrolled in this course' }
                            }
                        }
                    }
                }
            },
            500: {
                description: 'Internal Server Error',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { type: 'string', example: 'Internal server error' }
                            }
                        }
                    }
                }
            }
        }
    }
};

