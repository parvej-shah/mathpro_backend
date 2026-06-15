module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Get a user progress breakdown for a course',
  operationId: 'courseV2UserProgress',
  parameters: [
    {
      name: 'courseId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Course ID',
    },
    {
      name: 'userId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'User ID',
    },
  ],
  responses: {
    200: {
      description: 'User progress data',
    },
    400: {
      description: 'Failed to fetch progress',
    },
    401: {
      description: 'Unauthorized',
    },
    403: {
      description: 'Forbidden',
    },
  },
};
