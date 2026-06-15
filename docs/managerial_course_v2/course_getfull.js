module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Get full course hierarchy',
  operationId: 'courseV2GetFull',
  parameters: [
    {
      name: 'courseId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Course ID',
    },
  ],
  responses: {
    200: {
      description: 'Full course hierarchy',
    },
    400: {
      description: 'Failed to fetch course hierarchy',
    },
    401: {
      description: 'Unauthorized',
    },
    403: {
      description: 'Forbidden',
    },
  },
};
