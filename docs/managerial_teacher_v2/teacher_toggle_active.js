module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Toggle teacher active status',
  operationId: 'teacherToggleActive',
  parameters: [{ name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['isActive'],
          properties: {
            isActive: { type: 'boolean', example: true },
          },
        },
      },
    },
  },
  responses: {
    200: { description: 'Status updated successfully' },
    404: { description: 'Teacher not found' },
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
  },
};
