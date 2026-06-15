module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Get teachers by course',
  operationId: 'teacherGetByCourse',
  parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'integer' } }],
  responses: {
    200: { description: 'List of teachers' },
    404: { description: 'Course not found' },
    401: { description: 'Unauthorized' },
  },
};
