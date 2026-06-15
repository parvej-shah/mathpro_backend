module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Update a course',
  operationId: 'courseV2Update',
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
          $ref: '#/components/schemas/course',
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Course updated',
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
