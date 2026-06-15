module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Create a course',
  operationId: 'courseV2Create',
  parameters: [],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/course',
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Course created',
    },
    400: {
      description: 'Create failed',
    },
    401: {
      description: 'Unauthorized',
    },
  },
};
