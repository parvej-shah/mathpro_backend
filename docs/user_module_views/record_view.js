module.exports = {
    post: {
        tags: ['Module Views'],
        summary: 'Record module view',
        description: 'Record when a user views a module for a specific course. All views are stored in the database. If the same module is viewed multiple times, the view_count is incremented and last_viewed_at is updated.',
        operationId: 'recordModuleView',
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['courseId', 'moduleId', 'chapterId'],
                        properties: {
                            courseId: {
                                type: 'integer',
                                description: 'The course ID this view belongs to',
                                example: 11
                            },
                            moduleId: {
                                type: 'integer',
                                description: 'The module ID being viewed',
                                example: 2410
                            },
                            chapterId: {
                                type: 'integer',
                                description: 'The chapter ID containing the module',
                                example: 281
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Module view recorded successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                message: { type: 'string', example: 'Module view recorded successfully' },
                                data: {
                                    type: 'object',
                                    properties: {
                                        courseId: { type: 'integer', example: 11 },
                                        moduleId: { type: 'integer', example: 2410 },
                                        chapterId: { type: 'integer', example: 281 },
                                        timestamp: { type: 'integer', description: 'Unix timestamp', example: 1703123456 }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Bad Request - Missing or invalid parameters',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { type: 'string', example: 'courseId, moduleId, and chapterId are required' }
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

