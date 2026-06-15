module.exports = {
    get: {
        tags: ['Module Views'],
        summary: 'Get recent viewed modules',
        description: 'Retrieve the last 5 recently viewed modules for the specified course. All views are stored in the database, but this endpoint returns only the last 5 most recent views.',
        operationId: 'getRecentModuleViews',
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                in: 'path',
                name: 'courseId',
                required: true,
                schema: {
                    type: 'integer'
                },
                description: 'The course ID to fetch recent views for',
                example: 11
            }
        ],
        responses: {
            200: {
                description: 'Recent views retrieved successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: {
                                    type: 'object',
                                    properties: {
                                        courseId: { type: 'integer', example: 11 },
                                        recentViews: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    moduleId: { type: 'integer', example: 2410 },
                                                    chapterId: { type: 'integer', example: 281 },
                                                    moduleTitle: { type: 'string', example: 'Introduction to JavaScript' },
                                                    chapterTitle: { type: 'string', example: 'JavaScript Basics' },
                                                    timestamp: { type: 'integer', description: 'Unix timestamp', example: 1703123456 },
                                                    viewCount: { type: 'integer', description: 'Number of times this module was viewed', example: 3 }
                                                }
                                            }
                                        },
                                        totalViews: { type: 'integer', description: 'Total number of views stored for this course', example: 7 }
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

