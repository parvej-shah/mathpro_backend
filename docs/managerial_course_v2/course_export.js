module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Export course data (JSON or CSV)',
  operationId: 'courseExport',
  parameters: [
    {
      name: 'courseId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Course ID',
    },
    {
      name: 'format',
      in: 'query',
      schema: { type: 'string', enum: ['json', 'csv'], default: 'json' },
      description: 'Export format',
    },
    {
      name: 'include_content',
      in: 'query',
      schema: { type: 'string', enum: ['true', 'false'], default: 'true' },
      description: 'Include module content',
    },
    {
      name: 'include_quiz_answers',
      in: 'query',
      schema: { type: 'string', enum: ['true', 'false'], default: 'false' },
      description: 'Include quiz answers (encrypted)',
    },
  ],
  responses: {
    200: {
      description: 'Course exported successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object' },
            },
          },
        },
        'text/csv': {
          schema: { type: 'string' },
        },
      },
    },
    404: { description: 'Course not found' },
    401: { description: 'Unauthorized' },
  },
};
