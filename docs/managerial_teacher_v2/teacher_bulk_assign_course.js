module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Bulk assign teachers to course',
  operationId: 'teacherBulkAssignCourse',
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['course_id', 'teacher_ids'],
          properties: {
            course_id: { type: 'integer', example: 5 },
            teacher_ids: { type: 'array', items: { type: 'integer' }, example: [1, 2, 3] },
          },
        },
      },
    },
  },
  responses: {
    200: { description: 'Bulk assignment completed' },
    400: { description: 'Bad request' },
    404: { description: 'Course not found' },
    401: { description: 'Unauthorized' },
  },
};
