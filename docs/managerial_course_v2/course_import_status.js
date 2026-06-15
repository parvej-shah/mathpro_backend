module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Get import status by import_id',
  operationId: 'courseImportStatus',
  parameters: [
    {
      name: 'importId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Import ID from import response',
    },
  ],
  responses: {
    200: {
      description: 'Import status',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  import_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
                  status: {
                    type: 'string',
                    enum: ['processing', 'completed', 'failed'],
                    example: 'completed',
                  },
                  progress: { type: 'number', example: 100 },
                  summary: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      course_created: { type: 'boolean', example: true },
                      chapters_created: { type: 'integer', example: 5 },
                      modules_created: { type: 'integer', example: 20 },
                    },
                  },
                  errors: {
                    type: 'array',
                    nullable: true,
                    items: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    404: { description: 'Import not found' },
    401: { description: 'Unauthorized' },
  },
};
