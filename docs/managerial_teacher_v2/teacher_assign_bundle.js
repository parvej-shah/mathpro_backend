module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Assign teacher to bundle',
  operationId: 'teacherAssignBundle',
  parameters: [{ name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['bundle_id'],
          properties: {
            bundle_id: { type: 'integer', example: 3 },
          },
        },
      },
    },
  },
  responses: {
    200: { description: 'Teacher assigned successfully' },
    400: { description: 'Bad request' },
    404: { description: 'Teacher or bundle not found' },
    401: { description: 'Unauthorized' },
  },
};
