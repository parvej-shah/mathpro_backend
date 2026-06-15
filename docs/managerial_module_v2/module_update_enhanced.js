module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Module V2'],
  description: 'Update module with enhanced Phase 8 fields',
  operationId: 'moduleUpdateEnhanced',
  parameters: [
    {
      name: 'moduleId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Module ID',
    },
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string', example: 'Updated Module Title' },
            description: { type: 'string', nullable: true },
            quiz_time_limit: { type: 'integer', nullable: true, example: 30 },
            quiz_attempt_limit: { type: 'integer', nullable: true, example: 3 },
            pdf_drive_link: { type: 'string', nullable: true },
            data: { type: 'object', nullable: true },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Module updated successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'integer', example: 25 },
                  title: { type: 'string', example: 'Updated Module Title' },
                  message: { type: 'string', example: 'Module updated successfully' },
                },
              },
            },
          },
        },
      },
    },
    400: { description: 'Validation error' },
    404: { description: 'Module not found' },
    401: { description: 'Unauthorized' },
  },
};
