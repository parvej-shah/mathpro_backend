module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Get teacher statistics',
  operationId: 'teacherStats',
  parameters: [
    {
      name: 'teacherId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
    },
  ],
  responses: {
    200: {
      description: 'Teacher statistics',
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
                  total_courses: { type: 'integer', example: 5 },
                  total_bundles: { type: 'integer', example: 2 },
                  total_modules: { type: 'integer', example: 25 },
                  total_students: { type: 'integer', example: 150 },
                  average_rating: { type: 'number', nullable: true, example: null },
                },
              },
            },
          },
        },
      },
    },
    400: { description: 'Bad request' },
    404: { description: 'Teacher not found' },
    401: { description: 'Unauthorized' },
  },
};
