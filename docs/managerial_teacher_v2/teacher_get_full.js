module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Get single teacher (full info)',
  operationId: 'teacherGetFull',
  parameters: [{ name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } }],
  responses: {
    200: { description: 'Teacher full info' },
    404: { description: 'Teacher not found' },
    401: { description: 'Unauthorized' },
  },
};
