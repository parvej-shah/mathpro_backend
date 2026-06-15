module.exports = {
    post: {
        tags: ['Module Feedback'],
        summary: 'Submit or update module feedback',
        description: 'Submit a like/dislike reaction for a module with optional reason and comment. If feedback already exists, it will be updated.',
        operationId: 'submitModuleFeedback',
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['moduleId', 'reaction'],
                        properties: {
                            moduleId: {
                                type: 'integer',
                                description: 'ID of the module',
                                example: 123
                            },
                            reaction: {
                                type: 'string',
                                enum: ['like', 'dislike'],
                                description: 'User reaction',
                                example: 'dislike'
                            },
                            reason: {
                                type: 'string',
                                enum: [
                                    'too_fast', 'too_slow', 'unclear', 'outdated',
                                    'audio_issue', 'video_issue', 'missing_content',
                                    'too_difficult', 'too_easy', 'other'
                                ],
                                description: 'Reason for feedback (optional, especially for dislikes)',
                                example: 'unclear'
                            },
                            comment: {
                                type: 'string',
                                maxLength: 500,
                                description: 'Optional detailed comment or suggestion',
                                example: 'The recursion example was confusing, please add more diagrams'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Feedback submitted successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                message: { type: 'string', example: 'Feedback submitted successfully' },
                                data: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'integer', example: 1 },
                                        module_id: { type: 'integer', example: 123 },
                                        user_id: { type: 'integer', example: 456 },
                                        course_id: { type: 'integer', example: 10 },
                                        chapter_id: { type: 'integer', example: 25 },
                                        reaction: { type: 'string', example: 'dislike' },
                                        reason: { type: 'string', example: 'unclear' },
                                        comment: { type: 'string', example: 'The recursion example was confusing' },
                                        created_at: { type: 'string', format: 'date-time' },
                                        updated_at: { type: 'string', format: 'date-time' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Invalid request',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { type: 'string', example: 'Invalid reaction. Must be "like" or "dislike"' }
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

