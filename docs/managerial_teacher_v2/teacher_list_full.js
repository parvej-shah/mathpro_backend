module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Get all teachers (full info)',
  operationId: 'teacherListFull',
  responses: {
    200: { description: 'List of teachers with full info' },
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
  },
};
