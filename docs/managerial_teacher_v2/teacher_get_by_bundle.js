module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Get teachers by bundle',
  operationId: 'teacherGetByBundle',
  parameters: [{ name: 'bundleId', in: 'path', required: true, schema: { type: 'integer' } }],
  responses: {
    200: { description: 'List of teachers' },
    404: { description: 'Bundle not found' },
    401: { description: 'Unauthorized' },
  },
};
