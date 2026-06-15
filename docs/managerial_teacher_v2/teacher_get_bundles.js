module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Get all bundles for teacher',
  operationId: 'teacherGetBundles',
  parameters: [{ name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } }],
  responses: {
    200: { description: 'List of bundles' },
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
  },
};
