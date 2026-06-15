module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Remove teacher from course',
  operationId: 'teacherRemoveCourse',
  parameters: [
    { name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } },
    { name: 'courseId', in: 'path', required: true, schema: { type: 'integer' } },
  ],
  responses: {
    200: { description: 'Teacher removed successfully' },
    404: { description: 'Assignment not found' },
    401: { description: 'Unauthorized' },
  },
};
