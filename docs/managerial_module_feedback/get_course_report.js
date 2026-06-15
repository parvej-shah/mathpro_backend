module.exports = {
    get: {
        tags: ['Admin Module Feedback'],
        summary: 'Get course feedback report',
        description: 'Get comprehensive feedback report for a course including overall stats, per-module breakdown, problem modules, and top dislike reasons',
        operationId: 'getCourseModuleFeedbackReport',
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
                description: 'Report retrieved successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: {
                                    type: 'object',
                                    properties: {
                                        course_id: { type: 'integer', example: 10 },
                                        summary: {
                                            type: 'object',
                                            properties: {
                                                total_likes: { type: 'integer', example: 450 },
                                                total_dislikes: { type: 'integer', example: 30 },
                                                total_feedback: { type: 'integer', example: 480 },
                                                unique_users: { type: 'integer', example: 120 },
                                                modules_with_feedback: { type: 'integer', example: 25 },
                                                like_percentage: { type: 'integer', example: 94 }
                                            }
                                        },
                                        top_dislike_reasons: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    reason: { type: 'string', example: 'unclear' },
                                                    count: { type: 'integer', example: 12 }
                                                }
                                            }
                                        },
                                        problem_modules: {
                                            type: 'array',
                                            description: 'Modules with 3+ dislikes that need attention',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    module_id: { type: 'integer', example: 123 },
                                                    module_title: { type: 'string', example: 'Recursion Basics' },
                                                    chapter_title: { type: 'string', example: 'Advanced Topics' },
                                                    dislike_count: { type: 'integer', example: 8 }
                                                }
                                            }
                                        },
                                        modules: {
                                            type: 'array',
                                            description: 'Per-module feedback breakdown',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    module_id: { type: 'integer', example: 123 },
                                                    module_title: { type: 'string', example: 'Introduction' },
                                                    chapter_title: { type: 'string', example: 'Getting Started' },
                                                    chapter_serial: { type: 'integer', example: 1 },
                                                    module_serial: { type: 'integer', example: 1 },
                                                    likes: { type: 'integer', example: 45 },
                                                    dislikes: { type: 'integer', example: 2 },
                                                    total: { type: 'integer', example: 47 },
                                                    like_percentage: { type: 'integer', example: 96 }
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

