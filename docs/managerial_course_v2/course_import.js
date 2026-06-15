module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Import course from S3 object uploaded via presigned URL - Async operation',
  operationId: 'courseImport',
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['upload_key'],
          properties: {
            upload_key: {
              type: 'string',
              description: 'S3 object key returned from presigned upload',
              example: 'imports/courses/1736000000000_abcd1234_course.json',
            },
            format: {
              type: 'string',
              enum: ['csv', 'json'],
              description: 'File format (auto-detected if not provided)',
            },
            import_mode: {
              type: 'string',
              enum: ['create', 'update', 'upsert'],
              default: 'create',
              description: 'Import mode',
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Import started - returns import_id for status tracking',
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
                  message: { type: 'string', example: 'Import started. Use import_id to check status.' },
                },
              },
            },
          },
        },
      },
    },
    400: { description: 'Validation error' },
    401: { description: 'Unauthorized' },
  },
};
