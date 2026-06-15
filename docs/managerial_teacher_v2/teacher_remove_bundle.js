module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Remove teacher from bundle',
  operationId: 'teacherRemoveBundle',
  parameters: [
    { name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } },
    { name: 'bundleId', in: 'path', required: true, schema: { type: 'integer' } },
  ],
  responses: {
    200: { description: 'Teacher removed successfully' },
    404: { description: 'Assignment not found' },
    401: { description: 'Unauthorized' },
  },
};
