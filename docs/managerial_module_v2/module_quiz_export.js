module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Module V2'],
  description: 'Export quiz data (JSON) - Returns encrypted answers if include_answers=true',
  operationId: 'moduleQuizExport',
  parameters: [
    {
      name: 'moduleId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Module ID',
    },
    {
      name: 'format',
      in: 'query',
      schema: { type: 'string', enum: ['full', 'minimal'], default: 'full' },
      description: 'Export format',
    },
    {
      name: 'include_answers',
      in: 'query',
      schema: { type: 'string', enum: ['true', 'false'], default: 'false' },
      description: 'Include encrypted answers',
    },
  ],
  responses: {
    200: {
      description: 'Quiz exported successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  version: { type: 'string', example: '1.0' },
                  quiz: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        question: { type: 'string' },
                        options: { type: 'array', items: { type: 'string' } },
                        correct_answer: {
                          type: 'string',
                          description: 'Encrypted answer (only if include_answers=true)',
                        },
                      },
                    },
                  },
                  metadata: {
                    type: 'object',
                    properties: {
                      time_limit: { type: 'integer', nullable: true },
                      attempt_limit: { type: 'integer', nullable: true },
                      total_points: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    404: { description: 'Module not found or not a quiz' },
    401: { description: 'Unauthorized' },
  },
};
