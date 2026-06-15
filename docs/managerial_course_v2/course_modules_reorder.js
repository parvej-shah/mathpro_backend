module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Reorder modules across chapters',
  operationId: 'courseModulesReorder',
  parameters: [
    {
      name: 'courseId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Course ID',
    },
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['module_orders'],
          properties: {
            module_orders: {
              type: 'array',
              items: {
                type: 'object',
                required: ['module_id', 'chapter_id', 'serial'],
                properties: {
                  module_id: { type: 'integer', example: 25 },
                  chapter_id: { type: 'integer', example: 10 },
                  serial: { type: 'integer', example: 1 },
                },
              },
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Modules reordered successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  updated_count: { type: 'integer', example: 5 },
                  message: { type: 'string', example: 'Module order updated successfully' },
                },
              },
            },
          },
        },
      },
    },
    400: { description: 'Validation error' },
    404: { description: 'Course not found' },
    401: { description: 'Unauthorized' },
  },
};
