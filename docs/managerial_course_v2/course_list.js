module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'List courses available to the authenticated admin',
  operationId: 'courseV2List',
  parameters: [],
  responses: {
    200: {
      description: 'Course list',
    },
    400: {
      description: 'Failed to fetch courses',
    },
    401: {
      description: 'Unauthorized',
    },
  },
};
