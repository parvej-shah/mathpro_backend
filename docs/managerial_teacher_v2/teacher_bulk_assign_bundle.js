module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Bulk assign teachers to bundle',
  operationId: 'teacherBulkAssignBundle',
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['bundle_id', 'teacher_ids'],
          properties: {
            bundle_id: { type: 'integer', example: 3 },
            teacher_ids: { type: 'array', items: { type: 'integer' }, example: [1, 2, 3] },
          },
        },
      },
    },
  },
  responses: {
    200: { description: 'Bulk assignment completed' },
    400: { description: 'Bad request' },
    404: { description: 'Bundle not found' },
    401: { description: 'Unauthorized' },
  },
};
