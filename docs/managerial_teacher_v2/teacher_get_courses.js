module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Get all courses for teacher',
  operationId: 'teacherGetCourses',
  parameters: [{ name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } }],
  responses: {
    200: { description: 'List of courses' },
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
  },
};
