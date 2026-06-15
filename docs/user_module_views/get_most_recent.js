module.exports = {
    get: {
        tags: ['Module Views'],
        summary: 'Get most recent module',
        description: 'Get the single most recent module for the specified course, and also return the next module in sequence if it exists. The mostRecent module includes an isRecent flag indicating if it was viewed within the last 7 days.',
        operationId: 'getMostRecentModule',
        security: [{ bearerAuth: [] }],
        parameters: [
            {
                in: 'path',
                name: 'courseId',
                required: true,
                schema: {
                    type: 'integer'
                },
                description: 'The course ID to fetch the most recent module for',
                example: 11
            }
        ],
        responses: {
            200: {
                description: 'Most recent module retrieved successfully',
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
                                        mostRecent: {
                                            type: 'object',
                                            nullable: true,
                                            description: 'The most recently viewed module, or null if no views exist',
                                            properties: {
                                                moduleId: { type: 'integer', example: 2410 },
                                                chapterId: { type: 'integer', example: 281 },
                                                timestamp: { type: 'integer', description: 'Unix timestamp', example: 1703123456 },
                                                isRecent: { type: 'boolean', description: 'true if viewed within last 7 days', example: true }
                                            }
                                        },
                                        nextModule: {
                                            type: 'object',
                                            nullable: true,
                                            description: 'The next module in sequence after the most recent, or null if no next module exists',
                                            properties: {
                                                moduleId: { type: 'integer', example: 2411 },
                                                chapterId: { type: 'integer', example: 281 },
                                                moduleTitle: { type: 'string', example: 'Functions and Scope' },
                                                chapterTitle: { type: 'string', example: 'JavaScript Basics' }
                                            }
                                        }
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

