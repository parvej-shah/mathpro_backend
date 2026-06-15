module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Update full course hierarchy ordering',
  operationId: 'courseV2UpdateFull',
  parameters: [
    {
      name: 'courseId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Course ID',
    },
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            chapters: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Course hierarchy updated',
    },
    400: {
      description: 'Update failed',
    },
    401: {
      description: 'Unauthorized',
    },
    403: {
      description: 'Forbidden',
    },
  },
};
