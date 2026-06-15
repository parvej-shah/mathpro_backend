module.exports = {
    get: {
        tags: ['Module Feedback'],
        summary: 'Get module stats with user reaction',
        description: 'Get like/dislike counts for a module along with the current user\'s reaction (for UI display)',
        operationId: 'getModuleStatsWithReaction',
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
                                        likes: { type: 'integer', example: 45 },
                                        dislikes: { type: 'integer', example: 3 },
                                        user_reaction: { 
                                            type: 'string', 
                                            nullable: true,
                                            enum: ['like', 'dislike', null],
                                            example: 'like',
                                            description: 'Current user\'s reaction, null if not reacted'
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

