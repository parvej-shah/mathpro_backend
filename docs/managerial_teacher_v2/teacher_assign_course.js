module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Assign teacher to course',
  operationId: 'teacherAssignCourse',
  parameters: [
    {
      name: 'teacherId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
    },
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['course_id'],
          properties: {
            course_id: { type: 'integer', example: 5 },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Teacher assigned successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  teacher_id: { type: 'integer', example: 1 },
                  course_id: { type: 'integer', example: 5 },
                  message: { type: 'string', example: 'Teacher assigned to course successfully' },
                },
              },
            },
          },
        },
      },
    },
    400: { description: 'Bad request' },
    404: { description: 'Teacher or course not found' },
    401: { description: 'Unauthorized' },
  },
};
